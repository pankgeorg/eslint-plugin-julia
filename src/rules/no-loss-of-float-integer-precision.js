import { defineRule, isOpaque } from './common.js';
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: {
      description: 'Report integer-valued decimal float literals that lose integer precision.',
    },
    messages: {
      precision:
        'This {{format}} literal cannot exactly represent the written integer {{integer}}.',
    },
  },
  create(context) {
    function inspect(node) {
      if (isOpaque(node, context.sourceCode)) return;
      const raw = node.value.replaceAll('_', '');
      if (raw.length > 330) return;
      const match = raw.match(/^(-?\d+)(?:\.(0+))?(f0)?$/u);
      if (
        !match ||
        (node.kind === 'Float' && (!match[2] || match[3])) ||
        (node.kind === 'Float32' && !match[3])
      )
        return;
      let value = BigInt(match[1]);
      if (value < 0n) value = -value;
      const bits = node.kind === 'Float32' ? 24 : 53;
      const max = ((1n << BigInt(bits)) - 1n) << BigInt((bits === 24 ? 127 : 1023) - bits + 1);
      if (value > max) return;
      const excess = value.toString(2).length - bits;
      if (excess <= 0 || value % (1n << BigInt(excess)) === 0n) return;
      context.report({
        node,
        messageId: 'precision',
        data: { format: node.kind === 'Float32' ? 'Float32' : 'Float64', integer: match[1] },
      });
    }
    return { Float: inspect, Float32: inspect };
  },
});
