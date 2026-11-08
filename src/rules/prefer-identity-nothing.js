import { defineRule, isBareName, isOpaque, isSignature } from './common.js';
import { isInfixCall } from '../parser/flags.js';
export default defineRule({
  meta: {
    type: 'suggestion',
    fixable: 'code',
    hasSuggestions: true,
    docs: { description: 'Suggest identity comparisons with a bare nothing.' },
    schema: [
      { type: 'object', properties: { fix: { type: 'boolean' } }, additionalProperties: false },
    ],
    messages: {
      identity: 'Use {{replacement}} to compare with nothing.',
      replace: 'Replace with {{replacement}}.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    return {
      call(node) {
        if (
          !isInfixCall(node) ||
          node.children.length !== 3 ||
          isOpaque(node, source) ||
          isSignature(node, source)
        )
          return;
        const [left, op, right] = node.children;
        if (!['==', '!='].includes(op.value) || op.originalKind !== op.value) return;
        if (![left, right].some((n) => isBareName(n) && n.value === 'nothing')) return;
        const replacement = op.value === '==' ? '===' : '!==';
        const fix = (fixer) => fixer.replaceTextRange(op.range, replacement);
        context.report({
          node: op,
          messageId: 'identity',
          data: { replacement },
          ...(context.options[0]?.fix && { fix }),
          suggest: [{ messageId: 'replace', data: { replacement }, fix }],
        });
      },
    };
  },
});
