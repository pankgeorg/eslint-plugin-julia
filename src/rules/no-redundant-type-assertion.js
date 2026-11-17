import { check, ordinary, strip, stableType, span, text } from './semantic-common.js';
export default check(
  'Remove repeated nested expression type assertions.',
  (context, m, source) => ({
    '[kind="::"]'(node) {
      if (node.children.length !== 2 || !ordinary(node, source)) return;
      // A declaration/assignment target has conversion semantics, unlike an expression.
      for (let at = node, p = source.getParent(at); p; at = p, p = source.getParent(p)) {
        if (
          (p.kind === '=' && p.children[0] === at) ||
          ['local', 'global', 'const', 'struct'].includes(p.kind)
        )
          return;
        if (!['parens', '::', 'tuple'].includes(p.kind)) break;
      }
      const inner = strip(node.children[0]);
      if (inner?.kind !== '::' || inner.children.length !== 2) return;
      const type = stableType(node.children[1], m);
      if (!type || type !== stableType(inner.children[1], m)) return;
      const range = [span(source, node.children[0])[1], span(source, node)[1]];
      const comments = source.comments.some(
        (c) => c.range[0] >= range[0] && c.range[1] <= range[1],
      );
      context.report({
        node,
        messageId: 'diagnostic',
        data: { message: 'The outer expression assertion repeats the same stable type.' },
        ...(!comments && {
          fix: (fixer) =>
            fixer.replaceTextRange(span(source, node), text(source, node.children[0])),
        }),
      });
    },
  }),
  { fixable: 'code' },
);
