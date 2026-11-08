import {
  rule,
  ordinary,
  binary,
  strip,
  text,
  suggest,
  baseAvailable,
  call,
  integer,
} from './idiom-common.js';
export default rule(
  'Suggest isempty for zero-length or zero-dimension tests.',
  {
    allowLengthComparison: { type: 'boolean' },
    dimensions: { type: 'boolean' },
  },
  (context, m, source, options) => ({
    call(node) {
      const parts = binary(node);
      if (!parts || !ordinary(node, source) || options.allowLengthComparison) return;
      if (!m.isUnshadowedBuiltin(parts[1], parts[1].value)) return;
      let [a, op, b] = parts,
        operator = op.value,
        n = integer(b);
      if (n === null) {
        n = integer(a);
        a = b;
        operator = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[operator] ?? operator;
      }
      if (n !== 0n && n !== 1n) return;
      let args = call(strip(a), 'length', m),
        dimension = false;
      if (!args && options.dimensions !== false) {
        args = call(strip(a), 'size', m);
        dimension = true;
      }
      if (!args || args.length !== (dimension ? 2 : 1) || args.some((n) => n.kind === '...'))
        return;
      if (dimension && (integer(args[1]) !== 1n || n !== 0n || operator !== '==')) return;
      const empty = (n === 0n && ['==', '<='].includes(operator)) || (n === 1n && operator === '<');
      const nonempty =
        (n === 0n && ['!=', '>'].includes(operator)) || (n === 1n && operator === '>=');
      if (!empty && !nonempty) return;
      suggest(
        context,
        node,
        dimension
          ? 'Consider isempty for collection emptiness; a zero first dimension is a different test.'
          : 'Consider isempty instead of a length comparison.',
        baseAvailable(m, node)
          ? `${nonempty ? '!' : ''}Base.isempty(${text(source, args[0])})`
          : null,
      );
    },
  }),
);
