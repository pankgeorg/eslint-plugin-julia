import {
  rule,
  ordinary,
  call,
  strip,
  integer,
  binary,
  text,
  suggest,
  nodes,
  sameName,
  identifierName,
  baseAvailable,
} from './idiom-common.js';
export default rule(
  'Suggest eachindex when a range index is used only to index one collection.',
  {
    allowCapture: { type: 'boolean' },
  },
  (context, m, source, options) => ({
    JuliaFile() {
      for (const d of m.definitions) {
        if (d.kind !== 'iteration' || d.outer || !ordinary(d.node, source)) continue;
        const pair = d.assignment,
          clause = source.getParent(pair),
          range = strip(pair.children[1]),
          parts = binary(range);
        if (
          clause?.children.length !== 1 ||
          !parts ||
          !m.isUnshadowedBuiltin(parts[1], ':') ||
          integer(parts[0]) !== 1n ||
          parts[1].value !== ':'
        )
          continue;
        const args = call(parts[2], 'length', m),
          index = d.binding;
        if (
          !args ||
          args.length !== 1 ||
          identifierName(args[0]) === null ||
          !index ||
          index.definitions.length !== 1
        )
          continue;
        const array = args[0],
          refs = index.references.filter((r) => r.read);
        if (
          !refs.length ||
          refs.some((r) => {
            const p = source.getParent(r.node);
            return (
              p?.kind !== 'ref' ||
              p.children.length !== 2 ||
              p.children[1] !== r.node ||
              !sameName(p.children[0], array, m)
            );
          })
        )
          continue;
        if (
          !options.allowCapture &&
          refs.some((r) => {
            for (let at = r.scope; at && at !== d.scope; at = at.parent)
              if (at.kind === 'function') return true;
            return false;
          })
        )
          continue;
        let body = source.getParent(clause);
        if (body?.kind === 'filter') body = source.getParent(body);
        if (
          m.definitions.some(
            (n) =>
              n !== d &&
              n.name === identifierName(array) &&
              n.node.range[0] >= body.range[0] &&
              n.node.range[1] <= body.range[1],
          )
        )
          continue;
        const mutations = [
          'push!',
          'pushfirst!',
          'pop!',
          'popfirst!',
          'resize!',
          'empty!',
          'deleteat!',
          'insert!',
          'append!',
          'prepend!',
          'splice!',
          'delete!',
          'popat!',
          'filter!',
          'unique!',
          'keepat!',
        ];
        if (
          [...nodes(body)].some(
            (n) =>
              n.kind === 'call' &&
              mutations.includes(
                identifierName(n.children[0]) ?? identifierName(n.children[0]?.children?.[1]),
              ) &&
              n.children.slice(1).some((a) => sameName(a, array, m)),
          )
        )
          continue;
        suggest(
          context,
          range,
          'Use eachindex for generic collection indices; review mutation and custom axes.',
          baseAvailable(m, range) ? `Base.eachindex(${text(source, array)})` : null,
        );
      }
    },
  }),
);
