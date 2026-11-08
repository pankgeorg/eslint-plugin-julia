import { check, ordinary, binary, strip, text, span, baseAvailable } from './semantic-common.js';
export default check(
  'Report equality comparisons that cannot distinguish signed floating zero.',
  (context, m, source) => ({
    call(node) {
      const p = binary(node);
      if (!p || !ordinary(node, source)) return;
      const [a, op, b] = p;
      if (!['==', '!='].includes(op.value) || !m.isUnshadowedBuiltin(op, op.value)) return;
      const negativeZero = (node) => {
        node = strip(node);
        return (
          ['Float', 'Float32'].includes(node?.kind) &&
          /^-0+(?:\.0*)?(?:[ef][+-]?\d+)?$/iu.test(node.value.replaceAll('_', ''))
        );
      };
      if (!negativeZero(a) && !negativeZero(b)) return;
      const range = span(source, node);
      const comments = source.comments.some(
        (c) => c.range[0] >= range[0] && c.range[1] <= range[1],
      );
      const available =
        baseAvailable(m, node) &&
        (op.value === '==' || m.lookup('!', m.scopeFor(node))?.kind === 'builtin');
      const replacement = `${op.value === '!=' ? '!' : ''}Base.isequal(${text(source, a)}, ${text(source, b)})`;
      context.report({
        node,
        messageId: 'diagnostic',
        data: {
          message:
            'Numeric equality can treat negative and positive floating zero alike; review whether a sign-sensitive comparison was intended.',
        },
        ...(available &&
          !comments && {
            suggest: [
              {
                messageId: 'replace',
                data: {
                  message:
                    'Use isequal to distinguish signed zero (also changes missing/custom-type behavior).',
                },
                fix: (fixer) => fixer.replaceTextRange(range, replacement),
              },
            ],
          }),
      });
    },
  }),
  { suggestions: true },
);
