import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Report type parameters unused outside their own declaration.' },
    schema: [{ type: 'object', properties: { checkStructs: { type: 'boolean' }, ignoreFunctionsWithDynamicCode: { type: 'boolean' },
      ignoreParameters: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
    messages: { unused: 'Type parameter "{{name}}" is never used outside its own declaration.' } },
  create(context) { return { JuliaFile() {
    const m = getScopeManager(context.sourceCode), o = context.options[0] ?? {}, ignore = new Set(o.ignoreParameters);
    for (const d of m.definitions) {
      if (d.kind !== 'type-parameter' || ignore.has(d.name)) continue;
      if (d.scope.kind === 'type' && !o.checkStructs) continue;
      if (!['function', 'type'].includes(d.scope.kind)) continue;
      if (o.ignoreFunctionsWithDynamicCode && (context.sourceCode.getAncestors(d.node).some(n => n.kind === 'macrocall') || m.scopes.some(s => {
        if (s.dynamic && s.node.range[0] >= d.scope.node.range[0] && s.node.range[1] <= d.scope.node.range[1]) return true;
        for (let at = s; at; at = at.parent) if (at === d.scope) return s.dynamic; return false;
      }))) continue;
      const used = d.binding.references.some(r => r.read && !(r.node.range[0] >= d.parameter.range[0] && r.node.range[1] <= d.parameter.range[1]));
      if (!used) context.report({ node: d.node, messageId: 'unused', data: { name: d.name } });
    }
  } }; },
});
