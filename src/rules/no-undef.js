import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
function opaqueRead(reference, source) {
  if (reference.opaque) return true;
  for (let parent = source.getParent(reference.node); parent; parent = source.getParent(parent)) {
    // Written function bodies retain ordinary reads, including @inline/@node.
    if (['function', 'macro', '->', 'do'].includes(parent.kind)) return false;
    if (parent.kind === 'macrocall') return true;
  }
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
          unknownModules: { enum: ['ignore', 'report'] },
          unknownGlobals: { enum: ['ignore', 'report'] },
        },
        additionalProperties: false,
      },
    ],
    messages: { undefined: '"{{name}}" has no binding in this module.' },
  },
  create(context) {
    return {
      JuliaFile() {
        const m = getScopeManager(context.sourceCode, context),
          o = context.options[0] ?? {},
          globals = new Set(o.globals);
        for (const r of m.references) {
          if (
            r.binding ||
            opaqueRead(r, context.sourceCode) ||
            !r.read ||
            globals.has(r.name) ||
            o.unknownGlobals === 'ignore'
          )
            continue;
          // Module boundaries isolate both known exports and unknown-module fallbacks.
          const wildcards = r.scope.module.bareUsing;
          if (wildcards.some((n) => o.moduleExports?.[n]?.includes(r.name))) continue;
          if (
            o.unknownModules !== 'report' &&
            wildcards.some((n) => !Object.hasOwn(o.moduleExports ?? {}, n))
          )
            continue;
          context.report({ node: r.node, messageId: 'undefined', data: { name: r.name } });
        }
      },
    };
  },
});
