import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Report unresolved executable name reads.' },
    schema: [{ type: 'object', properties: {
      globals: { type: 'array', items: { type: 'string' }, uniqueItems: true },
      moduleExports: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
      unknownModules: { enum: ['ignore', 'report'] }, unknownGlobals: { enum: ['ignore', 'report'] },
    }, additionalProperties: false }], messages: { undefined: '"{{name}}" has no binding in this file.' } },
  create(context) {
    return { JuliaFile() {
      const m = getScopeManager(context.sourceCode), o = context.options[0] ?? {}, globals = new Set(o.globals);
      const wildcards = m.scopes.flatMap(s => s.bareUsing).filter(n => !['Base', 'Core'].includes(n));
      if (o.unknownModules !== 'report' && wildcards.some(n => !Object.hasOwn(o.moduleExports ?? {}, n))) return;
      const known = new Set(wildcards.flatMap(n => o.moduleExports?.[n] ?? []));
      for (const r of m.references) {
        if (r.binding || r.opaque || !r.read || globals.has(r.name) || known.has(r.name) || o.unknownGlobals === 'ignore') continue;
        context.report({ node: r.node, messageId: 'undefined', data: { name: r.name } });
      }
    } };
  },
});
