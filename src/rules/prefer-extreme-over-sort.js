import {
  rule,
  ordinary,
  call,
  strip,
  integer,
  text,
  suggest,
  baseAvailable,
} from './idiom-common.js';
import {
  initializedLocal,
  localBinding,
  positional,
  assignmentTarget,
} from './performance-common.js';
function integerVector(node, m) {
  node = strip(node);
  return (
    (node.kind === 'vect' &&
      node.children.length > 0 &&
      node.children.every((n) => integer(n) !== null)) ||
    (node.kind === 'ref' &&
      node.children.length > 1 &&
      m.isUnshadowedBuiltin(node.children[0], 'Int') &&
      positional(node.children.slice(1)))
  );
}
function knownIntegerVector(node, m, source) {
  if (integerVector(node, m)) return true;
  const init = initializedLocal(node, m, source);
  if (init && integerVector(init, m)) return true;
  const binding = localBinding(node, m),
    definition = binding?.definitions[0],
    parameter = definition?.parameter;
  if (
    binding?.definitions.length !== 1 ||
    definition.kind !== 'argument' ||
    parameter?.kind !== '::' ||
    parameter.children.length !== 2
  )
    return false;
  const type = strip(parameter.children[1]);
  return (
    type.kind === 'curly' &&
    type.children.length === 2 &&
    m.isUnshadowedBuiltin(type.children[0], 'Vector') &&
    m.isUnshadowedBuiltin(type.children[1], 'Int')
  );
}
export default rule(
  'Suggest an extremum instead of sorting an integer vector to select one end.',
  {},
  (context, m, source) => ({
    ref(node) {
      if (!ordinary(node, source) || assignmentTarget(node, source) || node.children.length !== 2)
        return;
      const index = strip(node.children[1]),
        first = integer(index) === 1n,
        last = index.originalKind === 'end';
      if (!first && !last) return;
      const args = call(node.children[0], 'sort', m);
      if (!positional(args) || args.length !== 1 || !knownIntegerVector(args[0], m, source)) return;
      const name = first ? 'minimum' : 'maximum';
      suggest(
        context,
        node,
        `Consider ${name} instead of retaining a sorted integer vector; review empty-input exceptions and custom methods.`,
        baseAvailable(m, node) ? `Base.${name}(${text(source, args[0])})` : null,
      );
    },
  }),
);
