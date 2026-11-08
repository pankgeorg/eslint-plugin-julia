import { defineRule, isOpaque } from './common.js';
const functions = new Set(['function', 'macro', '->', 'do']);
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: { description: 'Disallow explicit control flow escaping finally.' },
    messages: {
      issue: 'This {{exit}} escapes finally and may replace a pending return or exception.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    function check(node) {
      if ((!node.interior && node.kind === 'return') || isOpaque(node, source)) return;
      let crossedFinally = false;
      for (let child = node, p = source.getParent(child); p; child = p, p = source.getParent(p)) {
        if (p.kind === 'finally' && p.interior) crossedFinally = true;
        if (
          functions.has(p.kind) ||
          (node.kind !== 'return' &&
            ['for', 'while'].includes(p.kind) &&
            p.children.at(-1) === child)
        ) {
          if (crossedFinally)
            context.report({ node, messageId: 'issue', data: { exit: node.kind } });
          return;
        }
      }
      // Top-level escaping exits are hazards too, even when lowering rejects the target.
      if (crossedFinally) context.report({ node, messageId: 'issue', data: { exit: node.kind } });
    }
    return { return: check, break: check, continue: check };
  },
});
