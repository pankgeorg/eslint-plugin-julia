import { checkRule, ordinary, strip, binary, call, smallInteger, report, text, baseAvailable, nodes } from './correctness-common.js';
export default checkRule('Suggest short-circuit existence tests with any.', (context, m, source) => {
  function eligible(args) {
    return args?.length === 2 && !args.some(a => ['...', 'parameters'].includes(a.kind))
      && !['string', 'char', 'macrocall'].includes(strip(args[0]).kind)
      && ![...nodes(args[0])].some(n => n.kind === 'macrocall');
  }
  function emit(node, args, negate) {
    const negationAvailable = !negate || m.lookup('!', m.scopeFor(node))?.kind === 'builtin';
    report(context, node, 'Consider any for an existence test; review predicate and iterator effects before short-circuiting.',
      baseAvailable(m, node) && negationAvailable ? `${negate ? '!' : ''}Base.any(${args.map(a => text(source, a)).join(', ')})` : null);
  }
  return { call(node) {
    if (!ordinary(node, source)) return;
    const empty = call(node, 'isempty', m);
    if (empty?.length === 1) {
      const args = call(strip(empty[0]), 'filter', m);
      if (eligible(args)) {
        let target = node, parent = source.getParent(target);
        while (parent?.kind === 'parens') { target = parent; parent = source.getParent(target); }
        if (parent?.kind === 'call' && parent.children.length === 2 && parent.children[1] === target
          && m.isUnshadowedBuiltin(parent.children[0], '!')) emit(parent, args, false);
        else emit(node, args, true);
      }
      return;
    }
    const parts = binary(node);
    if (!parts) return;
    let [value, op, zero] = parts, operator = op.value;
    if (smallInteger(zero) !== 0) {
      [value, zero] = [zero, value];
      operator = ({ '<': '>', '>': '<' })[operator] ?? operator;
    }
    if (smallInteger(zero) !== 0 || !['>', '!=', '=='].includes(operator)) return;
    const args = call(strip(value), 'count', m);
    if (eligible(args) && m.isUnshadowedBuiltin(op, op.value)) emit(node, args, operator === '==');
  } };
}, true);
