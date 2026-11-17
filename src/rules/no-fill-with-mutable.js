import { rule, ordinary, call, strip, integer, suggest } from './idiom-common.js';
export default rule(
  'Warn when fill shares one fresh mutable object across slots.',
  {
    unknownDimensions: { type: 'boolean' },
  },
  (context, m, source, options) => ({
    call(node) {
      const args = call(node, 'fill', m);
      if (
        !args ||
        args.length < 2 ||
        !ordinary(node, source) ||
        args.some((n) => ['...', 'parameters'].includes(n.kind))
      )
        return;
      const value = strip(args[0]);
      const fresh =
        ['vect', 'hcat', 'vcat', 'typed_vcat', 'typed_hcat'].includes(value.kind) ||
        (value.kind === 'ref' &&
          ['Int', 'Float64', 'Any', 'String'].some((n) =>
            m.isUnshadowedBuiltin(value.children[0], n),
          )) ||
        ['Dict', 'Ref', 'zeros', 'ones'].some((name) => call(value, name, m));
      if (!fresh) return;
      const dims =
        args.length === 2 && strip(args[1]).kind === 'tuple'
          ? strip(args[1]).children
          : args.slice(1);
      const sizes = dims.map(integer);
      if (sizes.some((n) => n !== null && n <= 0n)) return;
      if (sizes.some((n) => n === null)) {
        if (options.unknownDimensions === false) return;
      } else if (!sizes.length || sizes.every((n) => n === 1n)) return;
      suggest(
        context,
        node,
        'fill stores the same mutable object in every slot; use independent allocations if sharing is unintended.',
      );
    },
  }),
  false,
);
