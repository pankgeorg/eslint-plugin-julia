import { defineRule, isBareName, isOpaque, normalizedTreeKey } from './common.js';
import { isInfixCall, isPrefixOperatorCall } from '../parser/flags.js';
const comparisons = new Set(['==', '!=', '===', '!==', '<', '<=', '>', '>=', 'in', '∈', '∉', 'isa']);
function eligible(n) {
  if (isBareName(n) || !n.interior && ['Bool', 'Integer', 'Float', 'Char'].includes(n.kind)) return true;
  if (n.kind === 'parens' && n.children.length === 1) return eligible(n.children[0]);
  if (['&&', '||'].includes(n.kind)) return n.children.every(eligible);
  if (isPrefixOperatorCall(n) && n.children[0]?.value === '!') return n.children.slice(1).every(eligible);
  if (isInfixCall(n) && n.children.length === 3 && comparisons.has(n.children[1].value)) return eligible(n.children[0]) && eligible(n.children[2]);
  if (n.kind === 'comparison') return n.children.every((c, i) => i % 2 ? comparisons.has(c.value) : eligible(c));
  return false;
}
export default defineRule({
  meta: { type: 'problem', schema: [], docs: { description: 'Report repeated conditions within one if/elseif chain.' }, messages: { issue: 'Condition repeats an earlier condition in this if chain.' } },
  create(context) {
    return { if(node) {
      if (!node.interior || isOpaque(node, context.sourceCode)) return;
      const seen = new Set();
      for (let branch = node; branch; branch = branch.children[2]?.kind === 'elseif' ? branch.children[2] : null) {
        const condition = branch.children[0];
        // An unknown evaluation can mutate earlier operands: stop this chain.
        if (!eligible(condition)) break;
        const key = normalizedTreeKey(condition);
        if (seen.has(key)) context.report({ node: condition, messageId: 'issue' });
        seen.add(key);
      }
    } };
  },
});
