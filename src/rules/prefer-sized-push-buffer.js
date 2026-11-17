import { rule, ordinary, call, nodes, span, text, baseAvailable } from './idiom-common.js';
import {
  rangeCount,
  arrayLiteral,
  localBinding,
  within,
  positional,
} from './performance-common.js';
export default rule(
  'Suggest reserving capacity for a fixed-count push! loop.',
  {
    minimumIterations: { type: 'integer', minimum: 1, maximum: 2147483647 },
  },
  (context, m, source, options) => ({
    for(node) {
      if (!ordinary(node, source)) return;
      const [clause, body] = node.children;
      if (clause.kind !== 'iteration' || clause.children.length !== 1) return;
      const count = rangeCount(clause.children[0].children[1], m);
      if (count === null || count < BigInt(options.minimumIterations ?? 16)) return;
      const block = source.getParent(node),
        index = block?.children.indexOf(node),
        init = block?.children[index - 1];
      if (block?.kind !== 'block' || init?.kind !== '=' || !arrayLiteral(init.children[1], m, true))
        return;
      const buffer = init.children[0],
        binding = localBinding(buffer, m);
      if (!binding || binding.definitions.length !== 1) return;
      const forbidden = [
        'macrocall',
        'quote',
        'inert',
        'function',
        '->',
        'do',
        'for',
        'while',
        'generator',
        'if',
        'elseif',
        '?',
        '&&',
        '||',
        'try',
        'return',
        'break',
        'continue',
        'let',
        'global',
        'local',
      ];
      if ([...nodes(body)].some((n) => forbidden.includes(n.kind))) return;
      const pushes = body.children.filter((n) => {
        const args = call(n, 'push!', m);
        return positional(args) && args.length === 2 && m.resolve(args[0]) === binding;
      });
      if (pushes.length !== 1) return;
      const args = call(pushes[0], 'push!', m),
        refs = binding.references.filter((r) => within(r.node, node));
      if (refs.length !== 1 || refs[0].node !== args[0]) return;
      const offset = span(source, init)[1],
        replacement = `\nBase.sizehint!(${text(source, buffer)}, ${count})`;
      context.report({
        node,
        messageId: 'diagnostic',
        data: {
          message: `This loop appends ${count} elements; consider reserving buffer capacity (push! is already amortized linear).`,
        },
        ...(baseAvailable(m, node) && {
          suggest: [
            {
              messageId: 'replace',
              data: { message: 'Reserve capacity after initialization; review allocation timing.' },
              fix: (fixer) => fixer.insertTextAfterRange([offset, offset], replacement),
            },
          ],
        }),
      });
    },
  }),
);
