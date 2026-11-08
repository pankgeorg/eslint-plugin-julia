import { rule, ordinary, call, strip, text, suggest, nodes } from './idiom-common.js';
export default rule(
  'Review sum of an immediately materialized one-dimensional comprehension.',
  {},
  (context, m, source) => ({
    call(node) {
      if (!ordinary(node, source)) return;
      const args = call(node, 'sum', m);
      if (args?.length !== 1) return;
      const comp = strip(args[0]),
        generator = comp.children[0];
      if (
        comp.kind !== 'comprehension' ||
        comp.children.length !== 1 ||
        generator?.kind !== 'generator' ||
        generator.children.length !== 2
      )
        return;
      const clause = generator.children[1];
      if (
        clause.kind !== 'iteration' ||
        clause.children.length !== 1 ||
        [...nodes(comp)].some((n) => ['macrocall', 'quote', 'inert'].includes(n.kind))
      )
        return;
      suggest(
        context,
        comp,
        'Consider a generator to avoid the intermediate Array; review reduction order, promotion, empty inputs and effect timing.',
        `(${text(source, generator)})`,
      );
    },
  }),
);
