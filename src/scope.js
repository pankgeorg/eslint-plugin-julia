import { readFileSync } from 'node:fs';
import { applyModuleResolution } from './module-resolution.js';
import { isInfixCall } from './parser/flags.js';
import { macroSignature, roleOf, UNKNOWN } from './macro-signatures.js';

const inventory = JSON.parse(
  readFileSync(new URL('../data/base-core-exports.json', import.meta.url)),
);
const core = new Set([...inventory.Core, 'ccall']),
  base = new Set(inventory.Base);
const builtin = new Map(
  [...base, ...core, 'include', 'eval'].map((name) => [
    name,
    {
      name,
      kind: 'builtin',
      builtin: core.has(name) ? 'Core' : 'Base',
      definitions: [],
      references: [],
      writes: [],
    },
  ]),
);
const cache = new WeakMap(),
  localCache = new WeakMap(),
  owners = new WeakMap();
export const identifierName = (node) =>
  node?.kind === 'Identifier'
    ? node.value
    : node?.kind === 'var'
      ? node.children[0]?.value
      : node?.kind === 'macro_name'
        ? `@${node.children[0]?.value}`
        : null;
export function bindingNames(node) {
  if (!node) return [];
  if (identifierName(node) !== null) return [node.kind === 'var' ? node.children[0] : node];
  if (['tuple', 'parameters', 'parens', 'block'].includes(node.kind))
    return node.children.flatMap(bindingNames);
  if (node.kind === 'comparison' && node.children.length === 5)
    return bindingNames(node.children[2]);
  if (
    node.kind === 'macrocall' &&
    ['@nospecialize', '@specialize'].includes(identifierName(node.children[0]))
  )
    return node.children.slice(1).flatMap(bindingNames);
  if (['=', '...', 'outer', '<:', '>:'].includes(node.kind)) return bindingNames(node.children[0]);
  if (node.kind === '::' && node.children.length === 2) return bindingNames(node.children[0]);
  return [];
}
// Resolution context is the ESLint rule context (physicalFilename + settings).
export function getScopeManager(sourceCode, context = {}) {
  const key = JSON.stringify([
    context.physicalFilename,
    context.settings?.julia?.entryFiles,
    context.settings?.julia?.macros,
    typeof context.settings?.julia?.resolver === 'function'
      ? 'function'
      : context.settings?.julia?.resolver,
    context.settings?.julia?.pkgjl,
    context.settings?.julia?.cacheDir,
    process.env.JULIA_DEPOT_PATH,
  ]);
  if (!cache.has(sourceCode)) cache.set(sourceCode, new Map());
  const managers = cache.get(sourceCode);
  if (!managers.has(key)) managers.set(key, analyze(sourceCode, context));
  return managers.get(key);
}
// Internal, filesystem-free pass used to extract facts from dependency syntax trees.
export function getLocalScopeManager(sourceCode) {
  if (!localCache.has(sourceCode)) localCache.set(sourceCode, analyze(sourceCode, null));
  return localCache.get(sourceCode);
}
export const resolve = (node) => owners.get(node)?.resolve(node) ?? null;
export const isReadReference = (node) => owners.get(node)?.referenceFor(node)?.read === true;
export const isUnshadowedBuiltin = (node, name) =>
  owners.get(node)?.isUnshadowedBuiltin(node, name) ?? false;

function analyze(source, context) {
  const scopes = [],
    references = [],
    definitions = [],
    nodeScopes = new WeakMap(),
    nodeReferences = new WeakMap();
  const nodeDefinitions = new WeakMap(),
    functions = [],
    exports = [],
    imports = [],
    // Macro arguments whose names are not reads (`quote`, `fields`, `symbol`, … roles).
    opaqueMacroArgs = new WeakSet(),
    // `$` interpolations in generated code, and the scope they are evaluated in.
    interpolations = new WeakMap(),
    userMacros = context?.settings?.julia?.macros;
  function scope(kind, node, parent, extra = {}) {
    const s = {
      kind,
      node,
      parent,
      bindings: new Map(),
      declarations: new Map(),
      candidates: [],
      children: [],
      bareUsing: [],
      dynamic: false,
      ...extra,
    };
    s.module = kind === 'module' ? s : parent.module;
    scopes.push(s);
    parent?.children.push(s);
    return s;
  }
  const root = scope('module', source.ast, null, { bare: false });
  function mark(node, s) {
    nodeScopes.set(node, s);
    owners.set(node, manager);
  }
  function ref(node, s, read = true, extra = {}) {
    if (!node) return;
    mark(node, s);
    const r = {
      node,
      name: identifierName(node),
      scope: s,
      read,
      write: !read,
      ...extra,
      binding: null,
    };
    references.push(r);
    nodeReferences.set(node, r);
    return r;
  }
  function define(node, s, kind, extra = {}) {
    if (
      !node ||
      (extra.name ?? identifierName(node)) === null ||
      /^_+$/u.test(identifierName(node) ?? '')
    )
      return;
    mark(node, s);
    const d = { node, name: identifierName(node), scope: s, kind, ...extra, binding: null };
    definitions.push(d);
    s.candidates.push(d);
    nodeDefinitions.set(node, d);
    return d;
  }
  function signatureScope(s) {
    return (s.signatureScope ??= scope('signature', s.node, s.parent, {
      aliasesFrom: s,
      transparent: s.kind === 'function',
    }));
  }
  function defaulted(node) {
    if (node.kind === '=') return true;
    if (node.kind === '::') return node.children.length === 2 && defaulted(node.children[0]);
    return (
      ['tuple', 'parens', '...', 'macrocall'].includes(node.kind) && node.children.some(defaulted)
    );
  }
  function pattern(node, s, kind, extra = {}) {
    if (!node) return;
    mark(node, s);
    const name = identifierName(node);
    if (name !== null) {
      define(node.kind === 'var' ? node.children[0] : node, s, kind, extra);
      return;
    }
    if (
      node.kind === 'macrocall' &&
      ['@nospecialize', '@specialize'].includes(identifierName(node.children[0]))
    ) {
      node.children.slice(1).forEach((n) => pattern(n, s, kind, extra));
    } else if (['tuple', 'parameters', 'parens', 'block'].includes(node.kind)) {
      for (const c of node.children) pattern(c, s, kind, extra);
    } else if (['...', 'outer'].includes(node.kind)) {
      pattern(node.children[0], s, kind, { ...extra, outer: node.kind === 'outer' || extra.outer });
    } else if (node.kind === '::') {
      if (node.children.length === 2) pattern(node.children[0], s, kind, { ...extra, typed: true });
      visit(node.children.at(-1), extra.typeScope ?? s);
    } else if (node.kind === '=') {
      visit(node.children[1], extra.defaultScope ?? s);
      pattern(node.children[0], s, kind, extra);
    } else visit(node, s); // property/index mutation reads its receiver and indices
  }
  function typeParameters(nodes, s) {
    const params = nodes.flatMap((n) => (n.kind === 'braces' ? n.children : [n]));
    for (const p of params)
      for (const n of bindingNames(p))
        define(n, s, 'type-parameter', { parameter: p, force: true });
    for (const p of params) {
      mark(p, s);
      if (['<:', '>:'].includes(p.kind))
        p.children.slice(1).forEach((n) => visit(n, signatureScope(s)));
      else if (p.kind === 'comparison') {
        // lower < T <: upper
        visit(p.children[0], signatureScope(s));
        visit(p.children.at(-1), signatureScope(s));
      }
    }
    return params;
  }
  function signature(sig, s, outer, fn) {
    mark(sig, s);
    if (sig.kind === 'where') {
      fn.typeParameters.push(...typeParameters(sig.children.slice(1), s));
      return signature(sig.children[0], s, outer, fn);
    }
    if (sig.kind === '::' && sig.children.length === 2) {
      visit(sig.children[1], s);
      return signature(sig.children[0], s, outer, fn);
    }
    if (sig.kind === 'parens' && sig.children.length === 1)
      return signature(sig.children[0], s, outer, fn);
    let args;
    if (fn.node.kind === 'function' && identifierName(sig) !== null) {
      define(sig.kind === 'var' ? sig.children[0] : sig, outer, 'function', {
        assignment: fn.node,
      });
      return;
    }
    if (sig.kind === 'call') {
      let head = sig.children[isInfixCall(sig) ? 1 : 0];
      if (head?.kind === 'curly') {
        head.children.slice(1).forEach((n) => visit(n, signatureScope(s)));
        head = head.children[0];
      }
      if (identifierName(head) !== null) {
        const n = head.kind === 'var' ? head.children[0] : head;
        define(n, outer, fn.node.kind === 'macro' ? 'macro' : 'function', {
          assignment: fn.node,
          name: fn.node.kind === 'macro' ? `@${identifierName(n)}` : identifierName(n),
        });
      } else if (head?.kind === '.') visit(head.children[0], outer);
      else argument(head, false);
      args = sig.children.filter((c) => c !== sig.children[isInfixCall(sig) ? 1 : 0]);
      fn.call = sig;
    } else args = ['tuple', 'parameters'].includes(sig.kind) ? sig.children : [sig];
    for (const arg of args) {
      if (arg.kind === 'parameters') for (const a of arg.children) argument(a, true);
      else argument(arg, false);
    }
    function argument(arg, keyword) {
      if (!arg) return;
      // Defaults run in wrapper methods: earlier parameters are aliases, body locals are unavailable.
      const prior = s.candidates.filter((d) =>
        ['argument', 'keyword', 'type-parameter', 'implicit-argument'].includes(d.kind),
      );
      const defaults = defaulted(arg)
        ? scope('default', arg, outer, { aliasDefinitions: prior })
        : null;
      const names = bindingNames(arg);
      pattern(arg, s, keyword ? 'keyword' : 'argument', {
        force: true,
        parameter: arg,
        assignment: arg,
        defaultScope: defaults ?? outer,
        typeScope: signatureScope(s),
      });
      fn.arguments.push(...names.map((n) => nodeDefinitions.get(n)).filter(Boolean));
    }
  }
  function iteration(clause, s) {
    if (clause.kind === 'filter') {
      s = iteration(clause.children[0], s);
      clause.children.slice(1).forEach((n) => visit(n, s));
      return s;
    }
    if (clause.kind !== 'iteration') {
      visit(clause, s);
      return s;
    }
    for (const pair of clause.children) {
      visit(pair.children[1], s);
      s = scope('for', pair, s);
      pattern(pair.children[0], s, 'iteration', { force: true, assignment: pair });
    }
    return s;
  }
  function quoted(node, s, depth) {
    mark(node, s);
    if (node.kind === '$') {
      if (depth === 1) node.children.forEach((n) => visit(n, s));
      else node.children.forEach((n) => quoted(n, s, depth - 1));
    } else node.children.forEach((n) => quoted(n, s, depth + (n.kind === 'quote' ? 1 : 0)));
  }
  function importStatement(node, s) {
    s = s.module;
    for (const clause of node.children) {
      const named = clause.kind === ':',
        paths = named ? clause.children.slice(1) : [clause];
      const pathText = (p) => source.getText(p).replace(/\s/gu, '');
      const moduleName = named
        ? pathText(clause.children[0])
        : pathText(clause.kind === 'as' ? clause.children[0] : clause);
      if (node.kind === 'using' && !named) s.bareUsing.push(moduleName);
      for (const p of paths) {
        const target = p.kind === 'as' ? p.children[1] : p.children.at(-1);
        if (!target) continue;
        const d = define(target, s, 'import', {
          force: true,
          moduleName,
          named,
          aliased: p.kind === 'as',
          importKind: node.kind,
          imported: source.getText(p),
          assignment: node,
        });
        if (d) imports.push(d);
      }
    }
  }
  function visit(node, s, extra = {}) {
    if (!node) return;
    mark(node, s);
    if (identifierName(node) !== null && node.kind !== 'macro_name') {
      const n = node.kind === 'var' ? node.children[0] : node;
      if (['end', 'begin'].includes(n.originalKind)) return;
      ref(n, s, true, extra);
      return;
    }
    if (!node.interior && node.kind !== 'JuliaFile') return;
    const c = node.children;
    switch (node.kind) {
      case 'quote':
      case 'inert':
        // Inside `@eval` code, a nested quote's `$` belongs to that quote, not to `@eval`.
        quoted(node, s, extra.interp ? 2 : 1);
        return;
      case 'macro_name':
        return;
      case 'macrocall': {
        const macroName =
          c[0]?.kind === '.' ? identifierName(c[0].children.at(-1)) : identifierName(c[0]);
        if (macroName === '@isdefined') return;
        s.dynamic = true;
        // A qualifier is a compile-time namespace lookup (never a runtime local); like v0.2.0,
        // no-undef doesn't check it.
        if (c[0]?.kind === '.') visit(c[0].children[0], s.module, { opaque: true });
        macroCall(node, macroName, s, extra);
        return;
      }
      case '$':
        // An interpolation into code generated by `@eval` reads its operand here.
        if (interpolations.has(node) || extra.interp) {
          const at = interpolations.get(node) ?? s;
          c.forEach((n) => visit(n, at, { ...extra, interp: false, checked: true }));
          return;
        }
        c.forEach((n) => visit(n, s, extra));
        return;
      case '-->':
      case ':=':
        // Plot-recipe attribute arrows (`seriestype --> :path`, `xguide := "x"`): the
        // left-hand side names an attribute, not a variable.
        c.slice(1).forEach((n) => visit(n, s, extra));
        return;
      case 'module': {
        define(c[0], s.module, 'module', { force: true, assignment: node });
        if (identifierName(c[0]) === null) visit(c[0], s, extra);
        const inner = scope('module', node, s, { bare: Boolean(node.flags & 256) });
        define(c[0], inner, 'module-self', { force: true });
        visit(c[1], inner);
        return;
      }
      case 'function':
      case 'macro':
      case '->':
      case 'do': {
        const inner = scope('function', node, s);
        const fn = { node, scope: inner, arguments: [], typeParameters: [], call: null };
        functions.push(fn);
        if (node.kind === 'macro')
          for (const name of ['__module__', '__source__'])
            define(
              { kind: 'Identifier', value: name, range: node.range, loc: node.loc },
              inner,
              'implicit-argument',
              { force: true },
            );
        if (['function', 'macro'].includes(node.kind) && identifierName(c[0]) !== null)
          define(c[0], s, node.kind, {
            assignment: node,
            name: node.kind === 'macro' ? `@${identifierName(c[0])}` : identifierName(c[0]),
          });
        else signature(c[0], inner, s, fn);
        visit(c[1], inner);
        return;
      }
      case 'struct':
      case 'abstract':
      case 'primitive': {
        const inner = scope('type', node, s);
        let head = c[0];
        if (head?.kind === '<:') {
          visit(head.children[1], signatureScope(inner));
          head = head.children[0];
        }
        if (head?.kind === 'curly') {
          typeParameters(head.children.slice(1), inner);
          head = head.children[0];
        }
        inner.typeDefinition = define(head, s, 'type', { assignment: node });
        inner.typeName = identifierName(head);
        if (node.kind === 'struct') {
          define(
            { kind: 'Identifier', value: 'new', range: head.range, loc: head.loc },
            inner,
            'intrinsic',
            { force: true },
          );
          const body = c.at(-1);
          mark(body, inner);
          // `@kwdef`: a field's default may read the fields before it (they are the keyword
          // constructor's arguments).
          let defaults = inner;
          if (extra.kwdef) {
            defaults = scope('kwdef', body, inner);
            for (let field of body.children) {
              if (field.kind === 'doc') field = field.children.at(-1);
              if (field.kind === 'macrocall' && identifierName(field.children[0]) === '@atomic')
                field = field.children.at(-1);
              if (field.kind === 'const') field = field.children[0];
              let name = field.kind === '=' ? field.children[0] : field;
              if (name?.kind === '::') name = name.children[0];
              if (identifierName(name) !== null)
                define(name, defaults, 'macro-binding', { force: true, opaque: true });
            }
          }
          for (let field of body.children) {
            // A documented field: `"doc" name::T`.
            if (field.kind === 'doc') {
              visit(field.children[0], inner);
              field = field.children.at(-1);
            }
            // An atomic field: `@atomic name::T`.
            if (field.kind === 'macrocall' && identifierName(field.children[0]) === '@atomic')
              field = field.children.at(-1);
            if (field.kind === 'const') field = field.children[0];
            if (identifierName(field) !== null) continue;
            if (field.kind === '::') visit(field.children.at(-1), signatureScope(inner));
            else if (field.kind === '=' && ['Identifier', '::'].includes(field.children[0]?.kind)) {
              if (field.children[0].kind === '::')
                visit(field.children[0].children.at(-1), signatureScope(inner));
              visit(
                field.children[1],
                defaults,
                extra.kwdef ? { opaque: true, checked: true } : {},
              );
            } else visit(field, inner);
          }
        } else c.slice(1).forEach((n) => visit(n, inner));
        return;
      }
      case 'where': {
        const inner = scope('where', node, s);
        typeParameters(c.slice(1), inner);
        visit(c[0], inner);
        return;
      }
      case 'let': {
        let inner = scope('let', node, s);
        for (const item of c[0].children) {
          if (item.kind === '=') visit(item.children[1], inner);
          const next = scope('let', item, inner);
          pattern(item.kind === '=' ? item.children[0] : item, next, 'let', {
            force: true,
            assignment: item,
          });
          inner = next;
        }
        visit(c[1], inner);
        return;
      }
      case 'for': {
        visit(c[1], iteration(c[0], s));
        return;
      }
      case 'generator': {
        let inner = scope('comprehension', node, s);
        for (const clause of c.slice(1)) inner = iteration(clause, inner);
        visit(c[0], inner);
        return;
      }
      case 'while': {
        const inner = scope('while', node, s);
        c.forEach((n) => visit(n, inner));
        return;
      }
      case 'try': {
        for (const part of c) {
          const inner = scope('try', part, s);
          if (part.kind === 'catch') {
            if (part.children.length > 1)
              pattern(part.children[0], inner, 'catch', { force: true, assignment: part });
            visit(part.children.at(-1), inner);
          } else visit(part, inner);
        }
        return;
      }
      case 'local':
      case 'global':
      case 'const':
        for (const item of c)
          declaration(item, s, {
            ...extra,
            ...(node.kind === 'const' ? { constant: true } : { declaration: node.kind }),
            assignment: item,
          });
        return;
      case 'import':
      case 'using':
        importStatement(node, s);
        return;
      case 'export':
      case 'public':
        for (const n of c) exports.push({ node: n, name: identifierName(n), scope: s.module });
        return;
      case '=':
      case 'op=':
      case '.=':
        if (node.kind === '.=') {
          c.forEach((n) => visit(n, s, extra));
          return;
        }
        if (node.kind === '=' && c[0]?.kind === 'curly') {
          const inner = scope('where', node, s);
          typeParameters(c[0].children.slice(1), inner);
          pattern(c[0].children[0], s, 'assignment', {
            ...extra,
            assignment: node,
            initialized: true,
          });
          visit(c[1], inner);
          return;
        }
        visit(c.at(-1), s, extra);
        if (node.kind === 'op=') {
          visit(c[1], s, extra);
          for (const n of bindingNames(c[0])) ref(n, s, true, extra);
        }
        pattern(c[0], s, 'assignment', { ...extra, assignment: node, initialized: true });
        return;
      case '.':
        visit(c[0], s, extra);
        return;
      case 'ref':
      case 'call':
      case 'dotcall':
        // `ccall(f, stdcall, …)`: a calling convention, not a variable.
        if (
          identifierName(c[0]) === 'ccall' &&
          ['cdecl', 'stdcall', 'fastcall', 'thiscall', 'llvmcall'].includes(identifierName(c[2]))
        ) {
          mark(c[2], s);
          [c[0], c[1], ...c.slice(3)].forEach((arg) => visit(arg, s, extra));
          return;
        }
        if (
          ['include', 'eval', 'include_string'].includes(identifierName(c[0])) ||
          (c[0]?.kind === '.' &&
            ['include', 'eval', 'include_string'].includes(identifierName(c[0].children[1])))
        )
          s.dynamic = true;
        for (const arg of c) {
          if (arg.kind === '=' && identifierName(arg.children[0]) !== null)
            visit(arg.children[1], s, extra);
          else visit(arg, s, extra);
        }
        return;
      case 'parameters':
        for (const item of c) {
          if (item.kind === '=') visit(item.children[1], s, extra);
          else visit(item, s, extra);
        }
        return;
      case 'tuple':
        for (const item of c) {
          if (item.kind === '=') visit(item.children[1], s, extra);
          else visit(item, s, extra);
        }
        return;
      default:
        c.forEach((n) => visit(n, s, extra));
    }
  }
  // The function (or module) a macro-introduced name belongs to: macros routinely
  // escape `for`/`let`/`try` blocks, and the wider scope is the conservative choice.
  function enclosingScope(s, where) {
    if (where === 'global') return s.module;
    let at = s;
    while (!['function', 'module'].includes(at.kind)) at = at.parent;
    return at;
  }
  // A name in a head position of a `bind`/`maybe` macro argument.
  function macroHead(n, s, mode, where, call, binding) {
    if (/^_+$/u.test(identifierName(n) ?? '')) return;
    if (mode === 'bind' && binding === 'assignment') {
      pattern(n, s, 'assignment', {
        assignment: call,
        initialized: true,
        ...(where === 'global' ? { declaration: 'global' } : {}),
      });
    } else if (mode === 'bind') {
      const target = enclosingScope(s, where);
      mark(n, s);
      define(n, target, 'macro-binding', {
        opaque: true,
        force: true,
        initialized: true,
        assignment: call,
        ...(where === 'global' ? { declaration: 'global' } : {}),
      });
    } else ref(n, s, true, { opaque: true, maybe: true });
  }
  const COMPARISONS = new Set([
    '<',
    '<=',
    '>',
    '>=',
    '==',
    '!=',
    '≤',
    '≥',
    '≠',
    'in',
    '∈',
    'isa',
    '<:',
  ]);
  // Head positions bind (`x`, `x = …`, `x::T`, `x(t)`, `x[1:3]`, comparison operands at the
  // top of an argument or a `begin` block); everything else in the argument is read.
  function macroHeads(node, s, mode, where, read, call, top, binding, placeholders) {
    if (!node) return;
    mark(node, s);
    const c = node.children,
      again = (n, t = false) => macroHeads(n, s, mode, where, read, call, t, binding, placeholders);
    if (identifierName(node) !== null && node.kind !== 'macro_name') {
      macroHead(node.kind === 'var' ? c[0] : node, s, mode, where, call, binding);
      return;
    }
    switch (node.kind) {
      case 'block':
      case 'tuple':
      case 'parens':
      case 'parameters':
        c.forEach((n) => again(n, top || node.kind === 'block'));
        return;
      case '=':
      case 'op=':
        again(c[0], true);
        visit(c.at(-1), s, read);
        return;
      case '::':
        if (c.length === 2) again(c[0]);
        visit(c.at(-1), s, read);
        return;
      case '...':
        again(c[0]);
        return;
      case 'ref':
        again(c[0]);
        for (const index of c.slice(1)) {
          const iterator =
            index.kind === '=' ||
            (index.kind === 'call' &&
              isInfixCall(index) &&
              ['in', '∈'].includes(identifierName(index.children[1])));
          if (iterator) {
            again(index.children[0]);
            visit(index.children.at(-1), s, read);
          } else visit(index, s, read);
        }
        return;
      case 'comparison':
        if (top) {
          c.forEach((n, i) => (i % 2 === 0 ? again(n) : mark(n, s)));
          return;
        }
        break;
      case 'call': {
        if (isInfixCall(node)) {
          const op = identifierName(c[1]);
          if (top && COMPARISONS.has(op)) {
            again(c[0]);
            again(c[2]);
            return;
          }
          if (op === '~') {
            again(c[0]);
            c.slice(2).forEach((n) => visit(n, s, read));
            return;
          }
          if (op === '=>' && top) {
            // Pattern-match arms (`Foo(a, b) => a + b`): the left side binds.
            macroPattern(c[0], s, mode, where, call, () => true);
            c.slice(2).forEach((n) => visit(n, s, read));
            return;
          }
          break;
        }
        if (identifierName(c[0]) === '~' && c.length === 2) {
          again(c[1]);
          return;
        }
        again(c[0]);
        // `u(..)`: a placeholder argument of a symbolic declaration, not a read.
        c.slice(1).forEach((n) => {
          if (identifierName(n) === '..') return;
          if (placeholders && mode === 'bind') opaqueMacroArgs.add(n);
          else visit(n, s, read);
        });
        return;
      }
    }
    visit(node, s, read);
  }
  // Every name `matches` accepts binds (its `_`-suffix stripped); other names are symbols.
  function macroPattern(node, s, mode, where, call, matches) {
    if (!node) return;
    mark(node, s);
    const name = identifierName(node);
    if (name !== null && node.kind !== 'macro_name') {
      const bound = matches(name);
      if (!bound) return;
      const n = node.kind === 'var' ? node.children[0] : node;
      if (bound === true) macroHead(n, s, mode, where, call);
      else
        macroHead(
          { ...n, value: bound, range: n.range, loc: n.loc, kind: 'Identifier', children: [] },
          s,
          mode,
          where,
          call,
        );
      return;
    }
    if (node.kind === '$') {
      visit(node, s, { opaque: true, checked: true });
      return;
    }
    node.children?.forEach((n) => macroPattern(n, s, mode, where, call, matches));
  }
  function macroFields(node, s, read) {
    if (!node || identifierName(node) !== null) return;
    mark(node, s);
    if (node.kind === '::') visit(node.children.at(-1), s, read);
    else if (node.kind === '=') {
      macroFields(node.children[0], s, read);
      visit(node.children[1], s, read);
    } else if (['braces', 'tuple', 'block', 'parameters', 'parens'].includes(node.kind))
      node.children.forEach((n) => macroFields(n, s, read));
    else visit(node, s, read);
  }
  // `@ccall lib.f(x::Cint; y::Cint)::Cint`: `f` names a C symbol; `lib`, arguments and types are read.
  function ccallSignature(node, s, read) {
    mark(node, s);
    if (node.kind === '::' && node.children.length === 2) {
      visit(node.children[1], s, read);
      node = node.children[0];
    }
    if (node.kind !== 'call') return visit(node, s, read);
    const head = node.children[0];
    if (head?.kind === '.') visit(head.children[0], s, read);
    else if (head?.kind === '$') visit(head, s, { ...read, interp: true });
    node.children.slice(1).forEach((n) => visit(n, s, read));
  }
  function macroCall(node, name, s, extra) {
    const args = node.children.slice(1),
      spec = macroSignature(name, userMacros),
      read = { ...extra, opaque: true, checked: true },
      opaque = (arg) => opaqueMacroArgs.add(arg);
    // An unknown macro used as a statement in a function, with only names and types as
    // arguments (`@unpack_tableau Tab T`), plausibly defines locals the source never writes.
    const name_ = (n) =>
      identifierName(n) !== null ||
      (n.kind === '.' && name_(n.children[0])) ||
      (n.kind === 'curly' && n.children.every(name_));
    if (
      spec === UNKNOWN &&
      args.length &&
      args.every(name_) &&
      source.getParent(node)?.kind === 'block' &&
      enclosingScope(s).kind === 'function'
    )
      enclosingScope(s).macroInjected = true;
    const role = (arg, r) => {
      if (r === 'expr') visit(arg, s, read);
      else if (r === 'quote') {
        opaque(arg);
        // `@eval` code runs at module scope; its `$` interpolations run here.
        const collect = (n, depth) => {
          if (n.kind === '$') {
            if (depth === 1) interpolations.set(n, s);
            else n.children.forEach((child) => collect(child, depth - 1));
          } else
            n.children?.forEach((child) => collect(child, depth + (n.kind === 'quote' ? 1 : 0)));
        };
        collect(arg, 1);
        visit(arg, spec.form === 'eval' ? s.module : s, { ...extra, opaque: true, interp: true });
      } else if (r === 'bind' || r === 'maybe')
        macroHeads(arg, s, r, spec.scope, read, node, true, spec.binding, spec.placeholders);
      else if (r === 'fields') {
        opaque(arg);
        macroFields(arg, s, read);
      } else if (r === 'pattern') {
        opaque(arg);
        macroPattern(
          arg,
          s,
          'bind',
          spec.scope,
          node,
          (n) => n.match(/^(.+?)__?(?:[A-Z]\w*)?$/u)?.[1] ?? null,
        );
      } else if (r === 'decorator') {
        let code = arg;
        while (code?.kind === '->') {
          visit(code.children[0], s, read);
          code = code.children[1];
        }
        visit(code, s.module, read);
      } else opaque(arg); // symbol, skip
    };
    switch (spec.form) {
      case 'eval':
        args.forEach((arg, i) => role(arg, args.length === 2 && i === 0 ? 'expr' : 'quote'));
        return;
      case 'ccall':
        for (const arg of args) {
          if (arg.kind === '=' && identifierName(arg.children[0]) !== null)
            visit(arg.children[1], s, read);
          else ccallSignature(arg, s, read);
        }
        return;
      case 'kwdef':
        args.forEach((arg) => visit(arg, s, { ...read, kwdef: true }));
        return;
      case 'doc':
        args.forEach((arg, i) => {
          if (i < args.length - 1 || !['call', 'where', '::', 'tuple', 'curly'].includes(arg.kind))
            visit(arg, s, read);
          else opaque(arg); // a documented method signature is not code
        });
        return;
      case 'signature': {
        const [sig, ...rest] = args;
        let head = sig;
        while (['where', '::'].includes(head?.kind)) head = head.children[0];
        if (head?.kind === 'call') head = head.children[0];
        if (head && identifierName(head) !== null)
          macroHeads(head, s, 'bind', 'global', read, node, true);
        [sig, ...rest].forEach((arg) => arg && opaque(arg));
        return;
      }
      case 'deprecate': {
        const [old, replacement, ...rest] = args;
        let head = old;
        while (['where', '::'].includes(head?.kind)) head = head.children[0];
        if (head?.kind === 'call') head = head.children[0];
        if (head && identifierName(head) !== null)
          macroHeads(head, s, 'bind', 'global', read, node, true);
        if (old) opaque(old);
        let target = replacement;
        while (['where', '::'].includes(target?.kind)) target = target.children[0];
        if (target?.kind === 'call') {
          opaque(replacement);
          visit(target.children[0], s, read);
        } else if (replacement) visit(replacement, s, read);
        rest.forEach((arg) => visit(arg, s, read));
        return;
      }
    }
    // `@testset "$name" for name in xs … end`: every argument is evaluated per iteration.
    const last = args.at(-1);
    if (spec.scope === 'inner' && last?.kind === 'for') {
      const inner = scope('testset', last, s);
      mark(last, inner);
      const each = iteration(last.children[0], inner);
      args.slice(0, -1).forEach((arg) => {
        if (spec.kw && arg.kind === '=' && identifierName(arg.children[0]) !== null)
          role(arg.children[1], spec.kw);
        else visit(arg, each, read);
      });
      visit(last.children[1], each, read);
      return;
    }
    args.forEach((arg, i) => {
      if (spec.kw && i > 0 && arg.kind === '=' && identifierName(arg.children[0]) !== null) {
        role(arg.children[1], spec.kw);
        return;
      }
      if (spec.scope === 'inner' && i === args.length - 1 && ['block', 'for'].includes(arg.kind)) {
        visit(arg, scope('testset', arg, s), read);
        return;
      }
      role(arg, roleOf(spec, i, args.length));
    });
  }
  function declaration(node, s, extra) {
    mark(node, s);
    if (['const', 'global', 'local'].includes(node.kind)) {
      for (const n of node.children)
        declaration(n, s, {
          ...extra,
          ...(node.kind === 'const' ? { constant: true } : { declaration: node.kind }),
        });
    } else if (node.kind === 'op=') {
      visit(node.children.at(-1), s);
      visit(node.children[1], s);
      for (const n of bindingNames(node.children[0])) ref(n, s);
      pattern(node.children[0], s, 'assignment', { ...extra, assignment: node, initialized: true });
    } else if (node.kind === '=') {
      if (node.children[0]?.kind === 'curly') {
        const inner = scope('where', node, s);
        typeParameters(node.children[0].children.slice(1), inner);
        visit(node.children[1], inner);
        pattern(node.children[0].children[0], s, 'assignment', {
          ...extra,
          assignment: node,
          initialized: true,
        });
      } else {
        visit(node.children[1], s);
        pattern(node.children[0], s, 'assignment', {
          ...extra,
          assignment: node,
          initialized: true,
        });
      }
    } else pattern(node, s, 'declaration', { ...extra, force: extra.declaration === 'local' });
  }
  function lookup(name, s) {
    for (let at = s; at; at = at.parent) {
      const b = at.bindings.get(name);
      if (b) return b;
      const m = at.macroBindings?.get(name);
      if (m) return m;
      if (at.kind === 'module')
        return !at.bare || at.bareUsing.includes('Base') || core.has(name)
          ? (builtin.get(name) ?? null)
          : null;
    }
    return null;
  }
  function localOuter(name, s) {
    for (let at = s.parent; at && at.kind !== 'module'; at = at.parent)
      if (at.bindings.has(name)) {
        const b = at.bindings.get(name);
        if (b.scope.kind !== 'module' || at.declarations.get(name) === 'global') return b;
      }
    return null;
  }
  function makeBinding(d, s) {
    if (!s.bindings.has(d.name))
      s.bindings.set(d.name, {
        name: d.name,
        kind: d.kind,
        scope: s,
        definitions: [],
        references: [],
        writes: [],
        constant: false,
      });
    return s.bindings.get(d.name);
  }
  const manager = {
    scopes,
    references,
    definitions,
    functions,
    exports,
    imports,
    globalScope: root,
    opaqueMacroArgs,
    scopeFor: (node) => nodeScopes.get(node),
    referenceFor: (node) =>
      nodeReferences.get(node) ??
      (node?.kind === 'var' ? nodeReferences.get(node.children[0]) : undefined),
    definitionFor: (node) => nodeDefinitions.get(node),
    resolve(node) {
      return (
        nodeDefinitions.get(node)?.binding ??
        nodeReferences.get(node)?.binding ??
        (node?.kind === 'var' ? this.resolve(node.children[0]) : null)
      );
    },
    lookup: (name, s = root) => lookup(name, s),
    isReadReference(node) {
      return this.referenceFor(node)?.read === true;
    },
    isUnshadowedBuiltin(node, name) {
      const trusted = (binding, target) => {
        if (!binding) return false;
        if (binding.kind === 'builtin') return binding.name === target;
        return (
          !binding.writes.length &&
          binding.definitions.some(
            (d) =>
              d.kind === 'import' &&
              ['Base', 'Core'].includes(d.moduleName) &&
              d.imported
                .split(/\s+as\s+/u)[0]
                .split('.')
                .at(-1)
                .trim() === target &&
              (d.moduleName === 'Core' ? core : base).has(target),
          )
        );
      };
      if (identifierName(node) !== null) return trusted(this.resolve(node), name);
      if (node?.kind !== '.' || identifierName(node.children[1]) !== name) return false;
      const receiver = this.resolve(node.children[0]);
      const namespace = ['Base', 'Core'].find((n) => trusted(receiver, n));
      return Boolean(namespace && (namespace === 'Core' ? core : base).has(name));
    },
  };
  if (source.diagnostics.some((d) => d.level === 1)) return manager;
  visit(source.ast, root);
  // Static method type expressions run in the outer value environment. Type-parameter
  // aliases stay local; other written definitions belong to the enclosing scope.
  for (const s of scopes.filter((s) => s.transparent)) {
    const retained = [];
    for (const d of s.candidates) {
      let target = s;
      while (
        target.transparent &&
        d.declaration !== 'local' &&
        !target.aliasesFrom.candidates.some((p) => p.kind === 'type-parameter' && p.name === d.name)
      )
        target = target.parent;
      if (target === s) retained.push(d);
      else {
        d.scope = target;
        target.candidates.push(d);
      }
    }
    s.candidates = retained;
  }
  // Declarations are scope-wide, even when written after assignments.
  for (const d of definitions) if (d.declaration) d.scope.declarations.set(d.name, d.declaration);
  // Parent scopes are finalized first; a later parent assignment is still captured.
  for (const s of scopes) {
    for (const d of s.aliasDefinitions ??
      s.aliasesFrom?.candidates.filter((d) => d.kind === 'type-parameter') ??
      [])
      if (d.binding) s.bindings.set(d.name, d.binding);
    const ordered = [...s.candidates].sort(
      (a, b) => Number(Boolean(b.force)) - Number(Boolean(a.force)),
    );
    for (const d of ordered) {
      const declaration = s.declarations.get(d.name);
      let b;
      if (declaration === 'global' || d.declaration === 'global') {
        b = makeBinding(d, s.module);
        if (s !== s.module) s.bindings.set(d.name, b); // lexical global declaration, inherited by descendants
      } else if (
        s.kind === 'type' &&
        d.kind === 'function' &&
        d.name === s.typeName &&
        s.typeDefinition?.binding
      ) {
        b = s.typeDefinition.binding;
        s.bindings.set(d.name, b);
      } else if (s.bindings.has(d.name)) b = s.bindings.get(d.name);
      else if ((d.force && !d.outer) || declaration === 'local' || s.kind === 'module')
        b = makeBinding(d, s);
      else b = localOuter(d.name, s) ?? makeBinding(d, s);
      d.binding = b;
      b.definitions.push(d);
      b.constant ||= Boolean(d.constant);
      if (d.initialized) b.writes.push(d);
    }
  }
  if (context) {
    applyModuleResolution(manager, source, context);
    for (const record of [...definitions, ...references]) owners.set(record.node, manager);
  }
  const resolveReference = (r) => {
    const declaration = r.scope.declarations.get(r.name);
    r.binding = lookup(r.name, declaration === 'global' ? r.scope.module : r.scope);
  };
  references.forEach(resolveReference);
  // A head-position name of an unknown macro (`@variables x`) that nothing else defines is
  // taken to be the macro's binding: it then also defines later reads of the name. These
  // bindings only suppress reports; they are kept out of `scope.bindings`.
  let introduced = false;
  for (const r of references)
    if (r.maybe && !r.binding) {
      const at = enclosingScope(r.scope);
      at.macroBindings ??= new Map();
      if (!at.macroBindings.has(r.name))
        at.macroBindings.set(r.name, {
          name: r.name,
          kind: 'macro-binding',
          scope: at,
          definitions: [],
          references: [],
          writes: [],
          constant: false,
          macro: true,
        });
      introduced = true;
    }
  if (introduced) for (const r of references) if (!r.binding) resolveReference(r);
  for (const r of references)
    if (r.binding && r.binding.kind !== 'builtin' && !r.binding.macro) r.binding.references.push(r);
  for (const s of scopes)
    for (const b of s.bindings.values()) {
      b.definitions.sort((a, b) => a.node.range[0] - b.node.range[0]);
      b.writes.sort((a, b) => a.node.range[0] - b.node.range[0]);
    }
  return manager;
}
