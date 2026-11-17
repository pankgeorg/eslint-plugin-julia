import { rule, ordinary, call, integer, text, suggest, baseAvailable } from './idiom-common.js';
import { positional, assignmentTarget } from './performance-common.js';
export default rule('Suggest querying one size dimension directly.', {}, (context, m, source) => ({
  ref(node) {
    if (!ordinary(node, source) || assignmentTarget(node, source) || node.children.length !== 2)
      return;
    const dimension = integer(node.children[1]),
      args = call(node.children[0], 'size', m);
    if (dimension === null || dimension <= 0n || args?.length !== 1 || !positional(args)) return;
    suggest(
      context,
      node,
      'Consider a direct size dimension query; review rank, bounds errors and custom size methods.',
      baseAvailable(m, node)
        ? `Base.size(${text(source, args[0])}, ${text(source, node.children[1])})`
        : null,
    );
  },
}));
