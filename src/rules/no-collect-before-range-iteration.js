import { rule, ordinary, call, suggest, text } from './idiom-common.js';
import { rangeCount } from './performance-common.js';
export default rule('Review collect of a literal integer range used only as a for iterator.', {}, (context, m, source) => ({ for(node) {
  if (!ordinary(node, source)) return;
  const clause = node.children[0];
  if (clause.kind !== 'iteration') return;
  for (const pair of clause.children) {
    const iterator = pair.children[1], args = call(iterator, 'collect', m);
    if (args?.length !== 1 || rangeCount(args[0], m) === null) continue;
    suggest(context, iterator, 'Iterate the literal integer range directly instead of collecting it; review allocation timing.', text(source, args[0]));
  }
} }));
