import { checkRule, ordinary, strip, call, report } from './correctness-common.js';
export default checkRule('Report immediate reads of uninitialized reference-stored Refs.', (context, m, source) => ({ ref(node) {
  if (!node.interior || node.children.length !== 1 || !ordinary(node, source)) return;
  // An indexing expression used as an assignment target is a write, not a read.
  let at = node, parent = source.getParent(at);
  while (parent?.kind === 'parens' || parent?.kind === 'tuple'
    || parent?.kind === '::' && parent.children[0] === at) { at = parent; parent = source.getParent(at); }
  if (parent?.kind === '=' && parent.children[0] === at) return;
  const allocation = strip(node.children[0]), args = call(allocation, 'Ref', m);
  if (!args || args.length) return;
  const head = strip(allocation.children[0]);
  if (head.kind !== 'curly' || head.children.length !== 2
    || !['String', 'Any', 'Function'].some(name => m.isUnshadowedBuiltin(strip(head.children[1]), name))) return;
  report(context, node, 'Reading this fresh uninitialized Ref throws UndefRefError; initialize it before reading.');
} }));
