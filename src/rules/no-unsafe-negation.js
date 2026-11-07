import { defineRule, isOpaque } from './common.js';
import { isInfixCall, isPrefixOperatorCall } from '../parser/flags.js';
const operators = new Set(['in', '∈', '∉', 'isa', '==', '!=', '===', '!==', '<', '<=', '>', '>=', '≤', '≥', '≠', '≡', '≢']);
export default defineRule({
  meta: { type: 'problem', hasSuggestions: true, schema: [], docs: { description: 'Require explicit grouping when negation precedes a comparison.' }, messages: { issue: 'Negation binds before this comparison; make the intended grouping explicit.', left: 'Parenthesize the negated left operand.', whole: 'Negate the whole comparison.' } },
  create(context) {
    const source = context.sourceCode;
    function check(node) {
      if (!node.interior || isOpaque(node, source)) return;
      if (!(node.kind === 'comparison' || node.kind === 'call' && isInfixCall(node))) return;
      const [left, op] = node.children;
      if (!operators.has(op?.value) || !isPrefixOperatorCall(left) || left.children.length !== 2 || left.children[0].value !== '!') return;
      const comments = source.comments.some(c => c.range[0] >= node.range[0] && c.range[1] <= node.range[1]);
      context.report({ node: left, messageId: 'issue', ...(!comments && { suggest: [
        { messageId: 'left', fix: fixer => fixer.replaceTextRange([left.children[0].range[0], left.range[1]], `(${source.text.slice(left.children[0].range[0], left.range[1])})`) },
        { messageId: 'whole', fix: fixer => fixer.replaceTextRange([left.children[0].range[0], node.range[1]], `!(${source.text.slice(left.children[1].range[0], node.range[1])})`) },
      ] }) });
    }
    return { call: check, comparison: check };
  },
});
