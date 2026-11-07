import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Report export/public names with no definition in this module.' },
    schema: [{ type: 'object', properties: { includes: { enum: ['skip', 'report'] }, unknownModules: { enum: ['skip', 'report'] },
      globals: { type: 'array', items: { type: 'string' } },
      moduleExports: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } }
    }, additionalProperties: false }], messages: { missing: 'Exported name "{{name}}" is not defined in this file’s module.' } },
  create(context) { return { JuliaFile() {
    const m = getScopeManager(context.sourceCode), o = context.options[0] ?? {}, globals = new Set(o.globals);
    const dynamic = new Set(m.references.filter(r => ['include', 'eval', 'include_string'].includes(r.name)).map(r => r.scope.module));
    const pending = [context.sourceCode.ast];
    while (pending.length) {
      const n = pending.pop(); pending.push(...n.children);
      if (n.kind === 'call' && n.children[0]?.kind === '.' && ['include', 'eval', 'include_string'].includes(n.children[0].children[1]?.value))
        dynamic.add(m.scopeFor(n).module);
    }
    for (const e of m.exports) {
      if (!e.name || globals.has(e.name) || m.lookup(e.name, e.scope)) continue;
      if (o.includes !== 'report' && dynamic.has(e.scope)) continue;
      if (e.scope.bareUsing.some(n => o.moduleExports?.[n]?.includes(e.name))) continue;
      if (o.unknownModules !== 'report' && e.scope.bareUsing.some(n => !['Base', 'Core'].includes(n) && !Object.hasOwn(o.moduleExports ?? {}, n))) continue;
      context.report({ node: e.node, messageId: 'missing', data: { name: e.name } });
    }
  } }; },
});
