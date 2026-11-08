import { defineRule, isBareName, isOpaque, normalizedTreeKey } from './common.js';
function unwrap(n) { while (n.kind === 'parens' && n.children.length === 1) n = n.children[0]; return n; }
function conditionContext(node, source) {
  for (let child = node, p = source.getParent(child); p; child = p, p = source.getParent(p)) {
    if (['parens', '&&', '||'].includes(p.kind)) continue;
    return ['if', 'elseif', 'while', '?'].includes(p.kind) && p.children[0] === child;
  }
  return false;
}
export default defineRule({
  meta: { type: 'problem', hasSuggestions: true, schema: [], docs: { description: 'Report repeated bare names in a logical chain without intervening effects.' }, messages: { issue: 'Repeated logical operand.', remove: 'Remove the repeated operand in this Boolean condition.' } },
  create(context) {
    const source = context.sourceCode;
    function check(node) {
      if (!node.interior || isOpaque(node, source)) return;
      let p = source.getParent(node);
      while (p?.kind === 'parens') p = source.getParent(p);
      if (p?.kind === node.kind) return;
      const operands = [], stack = [node];
      while (stack.length) {
        const n = unwrap(stack.pop());
        if (n.kind === node.kind && n.interior) stack.push(...n.children.toReversed());
        else operands.push(n);
      }
      const seen = new Set();
      for (let i = 0; i < operands.length; i++) {
        const n = operands[i];
        if (!isBareName(n)) { seen.clear(); continue; }
        const key = normalizedTreeKey(n);
        if (seen.has(key)) {
          const canSuggest = conditionContext(node, source) && !source.comments.some(c => c.range[0] >= node.range[0] && c.range[1] <= node.range[1]);
          const replacement = operands.filter((_, j) => j !== i).map(o => `(${source.getText(o)})`).join(` ${node.kind} `);
          context.report({ node: n, messageId: 'issue', ...(canSuggest && { suggest: [{ messageId: 'remove', fix: fixer => fixer.replaceTextRange([source.tokens.find(t => t.range[0] >= node.range[0] && t.range[1] <= node.range[1]).range[0], node.range[1]], replacement) }] }) });
        }
        seen.add(key);
      }
    }
    return { '[kind="&&"]': check, '[kind="||"]': check };
  },
});
