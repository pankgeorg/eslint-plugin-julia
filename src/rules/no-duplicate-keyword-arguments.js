import { defineRule, isBareName, isOpaque, isSignature } from './common.js';
import { isPrefixCall } from '../parser/flags.js';
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: { description: 'Disallow repeated explicit keyword names in a call.' },
    messages: { duplicate: 'Duplicate keyword argument "{{name}}".' },
  },
  create(context) {
    return {
      call(node) {
        if (
          !isPrefixCall(node) ||
          isOpaque(node, context.sourceCode) ||
          isSignature(node, context.sourceCode)
        )
          return;
        const args = node.children
          .slice(1)
          .flatMap((n) => (n.kind === 'parameters' && n.interior ? n.children : [n]));
        if (args.some((n) => n.kind === '...')) return;
        const seen = new Set();
        for (const arg of args) {
          if (
            arg.kind !== '=' ||
            !arg.interior ||
            arg.children.length !== 2 ||
            !isBareName(arg.children[0])
          )
            continue;
          const name = arg.children[0];
          if (seen.has(name.value))
            context.report({ node: name, messageId: 'duplicate', data: { name: name.value } });
          seen.add(name.value);
        }
      },
    };
  },
});
