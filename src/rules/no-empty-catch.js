import { defineRule, isOpaque } from './common.js';
export default defineRule({
  meta: { type: 'suggestion', docs: { description: 'Disallow empty catch blocks.' },
    schema: [{ type: 'object', properties: { allowComment: { type: 'boolean' } }, additionalProperties: false }],
    messages: { empty: 'Empty catch block.' } },
  create(context) {
    return { catch(node) {
      if (!node.interior || isOpaque(node, context.sourceCode)) return;
      const body = node.children.at(-1);
      if (body?.kind !== 'block' || !body.interior || body.children.length) return;
      if (context.options[0]?.allowComment && context.sourceCode.comments.some(c =>
        c.range[0] >= body.range[0] && c.range[1] <= body.range[1])) return;
      context.report({ node, messageId: 'empty' });
    } };
  },
});
