import { defineRule, isOpaque } from './common.js';
export default defineRule({
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    schema: [],
    docs: { description: 'Suggest combining an if whose only statement is another if.' },
    messages: {
      issue: 'These nested if conditions can be combined with &&.',
      combine: 'Combine conditions with &&.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    return {
      if(node) {
        if (!node.interior || node.children.length !== 2 || isOpaque(node, source)) return;
        const body = node.children[1];
        if (body?.kind !== 'block' || body.children.length !== 1) return;
        const inner = body.children[0];
        if (inner.kind !== 'if' || !inner.interior || inner.children.length !== 2) return;
        const comments = source.comments.some(
          (c) => c.range[0] >= node.range[0] && c.range[1] <= node.range[1],
        );
        const replacement = `if (${source.getText(node.children[0])}) && (${source.getText(inner.children[0])})${source.text.slice(inner.children[1].range[0], inner.range[1])}`;
        context.report({
          node,
          messageId: 'issue',
          ...(!comments && {
            suggest: [
              { messageId: 'combine', fix: (fixer) => fixer.replaceText(node, replacement) },
            ],
          }),
        });
      },
    };
  },
});
