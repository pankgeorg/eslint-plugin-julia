import { defineRule } from './common.js';
import { getScopeManager, identifierName } from '../scope.js';
import { isInfixCall } from '../parser/flags.js';

const BODY = new Set(['function', 'macro', '->', 'do']);
// Reads inside macro arguments are checked when the macro's signature says they are reads
// (`r.checked`); arguments it marks as generated code, symbols or field names are not reads.
function opaqueRead(reference, source, manager) {
  if (reference.opaque && !reference.checked) return true;
  if (reference.checked) return false;
  for (let n = reference.node; n; n = source.getParent(n)) {
    // Written function bodies retain ordinary reads, even inside generated code.
    if (BODY.has(n.kind)) return false;
    if (manager.opaqueMacroArgs?.has(n)) return true;
  }
  return false;
}
const VALUE_OPERATORS = new Set(['=>', '∘', '|>', '.', '::', '<:', '>:', 'where']);
// A position whose name can only be a value: an interpolation, an arithmetic or comparison
// operand, a condition, an index, a range endpoint, a `for` iterable. Call heads, call
// arguments, types and receivers are where an imported name usually appears.
function valuePosition(node, source, valuesTier) {
  const parent = source.getParent(node);
  if (!parent) return false;
  const c = parent.children;
  switch (parent.kind) {
    case 'string':
    case '&&':
    case '||':
    case 'comparison':
      return true;
    case 'if':
    case 'elseif':
    case 'while':
    case '?':
      return c[0] === node;
    case 'ref':
      return c[0] !== node;
    case 'call':
    case 'dotcall':
      if (isInfixCall(parent)) return c[1] !== node && !VALUE_OPERATORS.has(identifierName(c[1]));
      return valuesTier && c[0] !== node;
    case 'parameters':
      return valuesTier;
    case '=':
    case 'in':
    case '∈':
      return source.getParent(parent)?.kind === 'iteration' && c[1] === node;
    default:
      return false;
  }
}
// Positions where a module's exports appear: call heads, receivers, types, macro names.
function exportLike(node, source) {
  const parent = source.getParent(node);
  if (!parent) return false;
  const c = parent.children;
  if (['call', 'dotcall'].includes(parent.kind)) return c[isInfixCall(parent) ? 1 : 0] === node;
  if (parent.kind === '.') return c[0] === node;
  if (['::', '<:', '>:'].includes(parent.kind)) return c.at(-1) === node;
  if (['curly', 'where'].includes(parent.kind)) return true;
  return false;
}
// Inside a function whose statement-level macro may define locals (see scope.js).
function injected(scope) {
  for (let at = scope; at && at.kind !== 'module'; at = at.parent)
    if (at.macroInjected) return true;
  return false;
}
function insideBody(reference) {
  for (let at = reference.scope; at && at.kind !== 'module'; at = at.parent)
    if (at.kind === 'function') return true;
  return false;
}
export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Report unresolved executable name reads.' },
    schema: [
      {
        type: 'object',
        properties: {
          globals: { type: 'array', items: { type: 'string' }, uniqueItems: true },
          moduleExports: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
          unknownModules: { enum: ['ignore', 'values', 'report'] },
          unknownGlobals: { enum: ['ignore', 'report'] },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      undefined: '"{{name}}" has no binding in this module.',
      unresolvedOnly:
        '"{{name}}" is not defined in this function or module; it could only come from the unresolved `using {{module}}` (if so, import it explicitly: `using {{module}}: {{name}}`).',
      unresolvedContext:
        '"{{name}}" is not defined in this function or file; it could only come from the file that includes this one (no entry of the package includes it).',
      unresolvedEval:
        '"{{name}}" is not defined in this function or module; it could only be defined by code this module generates with `@eval` under a computed name.',
      unresolvedInclude:
        '"{{name}}" is not defined in this function or module; it could only come from a file this module includes at run time or by a computed path.',
    },
  },
  create(context) {
    return {
      JuliaFile() {
        const source = context.sourceCode,
          m = getScopeManager(source, context),
          o = context.options[0] ?? {},
          globals = new Set(o.globals),
          moduleExports = o.moduleExports ?? {};
        if (o.unknownGlobals === 'ignore') return;
        // Per module: names that appear unresolved somewhere in an export-like position.
        let exportish = null;
        const exportishIn = (module) => {
          exportish ??= new Map();
          if (!exportish.has(module)) {
            const names = new Set(m.exports.filter((e) => e.scope === module).map((e) => e.name));
            for (const r of m.references)
              if (!r.binding && r.scope.module === module && exportLike(r.node, source))
                names.add(r.name);
            exportish.set(module, names);
          }
          return exportish.get(module);
        };
        for (const r of m.references) {
          if (
            r.binding ||
            !r.read ||
            r.maybe ||
            globals.has(r.name) ||
            /^_+$/u.test(r.name ?? '') ||
            opaqueRead(r, source, m) ||
            injected(r.scope)
          )
            continue;
          // Module boundaries isolate both known exports and unknown-module fallbacks.
          const wildcards = r.scope.module.bareUsing;
          if (wildcards.some((n) => moduleExports[n]?.includes(r.name))) continue;
          const unknown = wildcards.filter((n) => !Object.hasOwn(moduleExports, n));
          const generated =
            r.scope.module.dynamicIncludes ||
            r.scope.module.dynamicDefinitions ||
            r.scope.module.includeFragment;
          if ((unknown.length || generated) && o.unknownModules !== 'report') {
            // An unresolved `using` could export any name. Only a value read inside a
            // function body of a lowercase, non-trivial name that the module never uses
            // the way imported names are used is reported.
            if (
              !insideBody(r) ||
              !/^[a-z][A-Za-z0-9_!]{2,}$/u.test(r.name) ||
              !valuePosition(r.node, source, o.unknownModules === 'values') ||
              exportishIn(r.scope.module).has(r.name)
            )
              continue;
            context.report({
              node: r.node,
              messageId: unknown.length
                ? 'unresolvedOnly'
                : r.scope.module.dynamicIncludes
                  ? 'unresolvedInclude'
                  : r.scope.module.dynamicDefinitions
                    ? 'unresolvedEval'
                    : 'unresolvedContext',
              data: { name: r.name, module: unknown[0] },
            });
            continue;
          }
          context.report({ node: r.node, messageId: 'undefined', data: { name: r.name } });
        }
      },
    };
  },
});
