import { rule, ordinary, call, strip, text, suggest, baseAvailable } from './idiom-common.js';
import { positional } from './performance-common.js';
const predicates = [
  'isodd',
  'iseven',
  'iszero',
  'isone',
  'isnothing',
  'ismissing',
  'isnan',
  'isfinite',
  'isinf',
  'isempty',
  'identity',
  'isletter',
  'isdigit',
  'isspace',
  'isascii',
];
export default rule(
  'Suggest count instead of materializing findall indices solely for length.',
  {},
  (context, m, source) => ({
    call(node) {
      if (!ordinary(node, source)) return;
      const outer = call(node, 'length', m);
      if (outer?.length !== 1) return;
      const args = call(outer[0], 'findall', m);
      if (!positional(args) || args.length !== 2) return;
      const predicate = strip(args[0]);
      if (
        predicate.kind !== '->' &&
        !predicates.some((name) => m.isUnshadowedBuiltin(predicate, name))
      )
        return;
      suggest(
        context,
        node,
        'Consider count instead of allocating matching indices only to count them; review custom collection methods.',
        baseAvailable(m, node)
          ? `Base.count(${text(source, args[0])}, ${text(source, args[1])})`
          : null,
      );
    },
  }),
);
