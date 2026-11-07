import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Disallow rebinding const globals.' },
    schema: [{ type: 'object', properties: { readonlyGlobals: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
    messages: { assign: 'Cannot reassign constant "{{name}}".' } },
  create(context) { return { JuliaFile() {
    const m = getScopeManager(context.sourceCode), readonly = new Set(context.options[0]?.readonlyGlobals), source = context.sourceCode;
    function arms(node) {
      const result = new Map();
      for (let child = node, parent = source.getParent(child); parent; child = parent, parent = source.getParent(parent))
        if (['if', 'elseif'].includes(parent.kind)) result.set(parent, parent.children.indexOf(child));
      return result;
    }
    function exclusive(a, b) {
      const left = arms(a), right = arms(b);
      return [...left].some(([n, arm]) => arm > 0 && right.has(n) && right.get(n) > 0 && right.get(n) !== arm);
    }
    for (const s of m.scopes.filter(s => s.kind === 'module')) for (const b of s.bindings.values()) {
      const origins = b.definitions.filter(d => d.constant && d.initialized);
      if (!origins.length && !readonly.has(b.name)) continue;
      for (const d of b.writes) {
        if (origins.length && !origins.some(c => c !== d
          && (d.scope !== b.scope || c.node.range[0] < d.node.range[0]) && !exclusive(c.node, d.node))) continue;
        context.report({ node: d.node, messageId: 'assign', data: { name: d.name } });
      }
    }
  } }; },
});
