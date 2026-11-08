import {
  check,
  ordinary,
  integer,
  strip,
  identifierName,
  hasCaptureOrOpaqueUse,
  span,
} from './semantic-common.js';
const hasDynamicScope = (scope) => scope.dynamic || scope.children.some(hasDynamicScope);
export default check(
  'Report adjacent literal stores overwritten before a local is read.',
  (context, m, source) => ({
    JuliaFile() {
      const smallLiteral = (node) => {
        node = strip(node);
        if (node?.kind === 'Bool') return true;
        const value = integer(node);
        return value !== null && value >= -2147483648n && value <= 2147483647n;
      };
      for (const fn of m.functions) {
        if (fn.node.kind !== 'function' || !ordinary(fn.node, source)) continue;
        const body = fn.node.children.at(-1);
        if (body.kind !== 'block' || hasDynamicScope(fn.scope)) continue;
        const statements = body.children;
        for (let i = 0; i + 1 < statements.length; i++) {
          const a = statements[i],
            b = statements[i + 1];
          if (
            a.kind !== '=' ||
            b.kind !== '=' ||
            !smallLiteral(a.children[1]) ||
            !smallLiteral(b.children[1])
          )
            continue;
          if (identifierName(a.children[0]) === null || identifierName(b.children[0]) === null)
            continue;
          const binding = m.resolve(a.children[0]);
          if (
            !binding ||
            binding !== m.resolve(b.children[0]) ||
            binding.scope !== fn.scope ||
            binding.constant ||
            binding.definitions.some((d) => d.typed || d.declaration || d.opaque) ||
            hasCaptureOrOpaqueUse(binding, source)
          )
            continue;
          if (!binding.references.some((r) => r.read && r.node.range[0] > b.range[1])) continue;
          const range = span(source, a);
          const comments = source.comments.some(
            (c) => c.range[0] >= a.range[0] && c.range[1] <= b.range[0],
          );
          context.report({
            node: a,
            messageId: 'diagnostic',
            data: {
              message:
                'This literal local value is overwritten by the next statement before it is read.',
            },
            ...(!comments && {
              suggest: [
                {
                  messageId: 'replace',
                  data: { message: 'Remove the overwritten store.' },
                  fix: (fixer) => fixer.removeRange(range),
                },
              ],
            }),
          });
        }
      }
    },
  }),
  { suggestions: true },
);
