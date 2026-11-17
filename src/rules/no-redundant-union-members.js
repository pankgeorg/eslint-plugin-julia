import { check, strip, stableType, span } from './semantic-common.js';
import { isOpaque } from './common.js';
export default check(
  'Report repeated stable named members of builtin Union.',
  (context, m, source) => ({
    curly(node) {
      if (isOpaque(node, source) || !m.isUnshadowedBuiltin(strip(node.children[0]), 'Union'))
        return;
      const seen = new Set(),
        members = node.children.slice(1);
      for (const [i, member] of members.entries()) {
        const identity = stableType(member, m);
        if (!identity) continue;
        if (seen.has(identity)) {
          const range =
            i === members.length - 1
              ? [span(source, members[i - 1])[1], span(source, member)[1]]
              : [span(source, member)[0], span(source, members[i + 1])[0]];
          const comments = source.comments.some(
            (c) => c.range[0] >= range[0] && c.range[1] <= range[1],
          );
          context.report({
            node: member,
            messageId: 'diagnostic',
            data: { message: 'This stable type is already a member of the Union.' },
            ...(!comments && {
              suggest: [
                {
                  messageId: 'replace',
                  data: { message: 'Remove the repeated member.' },
                  fix: (fixer) => fixer.removeRange(range),
                },
              ],
            }),
          });
        }
        seen.add(identity);
      }
    },
  }),
  { suggestions: true },
);
