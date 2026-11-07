import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Disallow rebinding explicitly imported names.' },
    schema: [{ type: 'object', properties: { moduleExports: { type: 'object', additionalProperties: {
      type: 'array', items: { type: 'string' } } } }, additionalProperties: false }],
    messages: { assign: 'Cannot assign imported binding "{{name}}".' } },
  create(context) { return { JuliaFile() {
    const m = getScopeManager(context.sourceCode), o = context.options[0] ?? {}, source = context.sourceCode;
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
    for (const d of m.definitions) {
      if (!d.initialized || d.binding.scope.kind !== 'module') continue;
      const explicit = d.binding.definitions.some(n => n.kind === 'import' && !exclusive(d.node, n.node));
      const configured = d.binding.scope.bareUsing.some(n => o.moduleExports?.[n]?.includes(d.name));
      if (explicit || configured) context.report({ node: d.node, messageId: 'assign', data: { name: d.name } });
    }
  } }; },
});
