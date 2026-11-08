import {
  rule,
  ordinary,
  binary,
  text,
  suggest,
  baseAvailable,
  call,
  strip,
  identifierName,
} from './idiom-common.js';
const abstracts = [
  'Any',
  'Number',
  'Real',
  'Integer',
  'Signed',
  'Unsigned',
  'AbstractFloat',
  'AbstractArray',
  'AbstractString',
  'AbstractDict',
  'AbstractSet',
];
export default rule(
  'Suggest isa for typeof type tests.',
  {
    abstractTypes: { type: 'array', items: { type: 'string' } },
    exactTypes: { type: 'boolean' },
  },
  (context, m, source, options) => {
    function check(node) {
      const parts = binary(node);
      if (!parts || !ordinary(node, source)) return;
      if (
        node.kind === '<:'
          ? m.lookup('<:', m.scopeFor(node))?.kind !== 'builtin'
          : !m.isUnshadowedBuiltin(parts[1], parts[1].value)
      )
        return;
      let [a, op, b] = parts,
        args = call(a, 'typeof', m);
      if (!args) {
        if (op.value === '<:') return;
        [a, b] = [b, a];
        args = call(a, 'typeof', m);
      }
      if (!args || args.length !== 1 || args[0].kind === '...') return;
      const target = strip(b),
        name = identifierName(target),
        binding = m.resolve(target);
      if (name === null && target.kind !== '.') return;
      const abstract =
        abstracts.some((n) => m.isUnshadowedBuiltin(target, n)) ||
        options.abstractTypes?.includes(name) ||
        binding?.definitions.some((d) => d.kind === 'type' && d.assignment?.kind === 'abstract');
      if (!['==', '!=', '===', '!==', '<:'].includes(op.value)) return;
      if (!abstract && (!['==', '!=', '<:'].includes(op.value) || options.exactTypes === false))
        return;
      const positive = `Base.isa(${text(source, args[0])}, ${text(source, target)})`;
      suggest(
        context,
        node,
        'Consider isa for type membership; exact concrete-type tests may be intentional.',
        baseAvailable(m, node) ? `${['!=', '!=='].includes(op.value) ? '!' : ''}${positive}` : null,
      );
    }
    return { call: check, '[kind="<:"]': check };
  },
);
