import { checkRule, ordinary, strip, call, nodes, report, identifierName } from './correctness-common.js';
import { isOpaque } from './common.js';
export default checkRule('Report literal foreign-call arity and annotation errors.', (context, m, source) => ({
  call(node) {
    if (!ordinary(node, source)) return;
    const args = node.children.slice(1);
    if (args.length < 3) return;
    const tuple = strip(args[2]);
    if (tuple.kind !== 'tuple' || args.some(n => [...nodes(n)].some(c => ['...', 'parameters'].includes(c.kind)))) return;
    if (tuple.children.length !== args.length - 3 && call(node, 'ccall', m))
      report(context, node, 'The literal ccall type tuple and supplied value arguments have different lengths.');
  },
  macrocall(node) {
    // @ccall is the sole transparent macro here. All enclosing macros stay opaque.
    if (!node.interior || source.getAncestors(node).some(n => ['macrocall', 'quote', 'inert'].includes(n.kind))) return;
    const [head, expression] = node.children;
    const qualified = head?.kind === '.' && identifierName(head.children[1]) === '@ccall'
      && m.isUnshadowedBuiltin(head.children[0], 'Base');
    const binding = identifierName(head) === '@ccall' && m.lookup('@ccall', m.scopeFor(node));
    if (!qualified && binding?.kind !== 'builtin') return;
    const annotated = strip(expression);
    if (node.children.length !== 2 || annotated?.kind !== '::') return;
    const invocation = strip(annotated.children[0]);
    if (invocation?.kind !== 'call' || isOpaque(source.getParent(node), source)) return;
    const args = invocation.children.slice(1).flatMap(n => n.kind === 'parameters' ? n.children : [n]);
    if (args.some(n => [...nodes(n)].some(c => c.kind === '...'))) return;
    for (const arg of args) if (strip(arg).kind !== '::')
      report(context, arg, 'Each @ccall value argument needs an explicit ::CType annotation.');
  },
}));
