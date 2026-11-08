import { rule, ordinary, call, strip, text, suggest } from './idiom-common.js';
import { initializedLocal, arrayLiteral } from './performance-common.js';
export default rule('Review a full local Array copy immediately consumed by length, sum or a loop.', {}, (context, m, source) => ({ ref(node) {
  if (!ordinary(node, source) || node.children.length !== 2 || node.children[1].kind !== ':') return;
  const array = node.children[0], init = initializedLocal(array, m, source);
  if (!init || !arrayLiteral(init, m)) return;
  let at = node, parent = source.getParent(at);
  while (parent?.kind === 'parens') { at = parent; parent = source.getParent(at); }
  const length = call(parent, 'length', m), sum = call(parent, 'sum', m);
  const isLength = length?.length === 1 && strip(length[0]) === node;
  const isSum = sum?.length === 1 && strip(sum[0]) === node;
  const clause = source.getParent(parent), loop = source.getParent(clause);
  const iteration = ['in', '='].includes(parent?.kind) && strip(parent.children[1]) === node && clause?.kind === 'iteration' && loop?.kind === 'for';
  if (!isLength && !isSum && !iteration) return;
  suggest(context, node, isLength ? 'This full Array copy is used only for length; consider querying the original array.' : 'This consumer immediately uses a full Array copy; review snapshot, mutation, shape and reduction semantics before removing it.',
    isLength ? text(source, array) : null);
} }));
