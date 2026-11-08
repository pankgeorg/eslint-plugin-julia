import { defineRule, isBareName, isOpaque } from './common.js';
function fieldName(node) {
  if (node.kind === 'const' && node.interior && node.children.length === 1) node = node.children[0];
  if (isBareName(node)) return node;
  if (
    node.kind === '::' &&
    node.interior &&
    node.children.length === 2 &&
    isBareName(node.children[0])
  )
    return node.children[0];
  return null;
}
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: { description: 'Disallow repeated direct struct field names.' },
    messages: { duplicate: 'Duplicate struct field "{{name}}".' },
  },
  create(context) {
    return {
      struct(node) {
        if (!node.interior || isOpaque(node, context.sourceCode)) return;
        const body = node.children.at(-1);
        if (body?.kind !== 'block' || !body.interior) return;
        const seen = new Set();
        for (const declaration of body.children) {
          const name = fieldName(declaration);
          if (!name) continue;
          if (seen.has(name.value))
            context.report({ node: name, messageId: 'duplicate', data: { name: name.value } });
          seen.add(name.value);
        }
      },
    };
  },
});
