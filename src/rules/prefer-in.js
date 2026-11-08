import { rule, ordinary, call, strip, binary, text, suggest, identifierName } from './idiom-common.js';
export default rule('Suggest membership for simple any equality searches.', {}, (context, m, source) => ({ call(node) {
  const args = call(node, 'any', m);
  if (!args || args.length !== 2 || !ordinary(node, source) || identifierName(args[1]) === null) return;
  if (m.functions.some(fn => fn.call && node.range[0] >= fn.node.range[0] && node.range[1] <= fn.node.range[1]
    && m.isUnshadowedBuiltin(strip(fn.call.children[0]), 'in'))) return;
  const predicate = strip(args[0]); let needle;
  const partial = call(predicate, '==', m);
  if (partial?.length === 1) needle = partial[0];
  else if (predicate.kind === '->') {
    const fn = m.functions.find(fn => fn.node === predicate);
    if (!fn || fn.arguments.length !== 1) return;
    let parameterNode = strip(predicate.children[0]);
    if (parameterNode.kind === 'tuple' && parameterNode.children.length === 1) parameterNode = strip(parameterNode.children[0]);
    if (identifierName(parameterNode) === null) return;
    let body = strip(predicate.children[1]);
    if (body.kind === 'block' && body.children.length === 1) body = strip(body.children[0]);
    const parts = binary(body);
    if (!parts || parts[1].value !== '==' || !m.isUnshadowedBuiltin(parts[1], '==')) return;
    const parameter = fn.arguments[0].binding;
    if (m.resolve(strip(parts[0])) === parameter) needle = strip(parts[2]);
    else if (m.resolve(strip(parts[2])) === parameter) needle = strip(parts[0]);
    if (needle && m.resolve(needle) === parameter) return;
  }
  if (!needle || !(identifierName(needle) !== null || ['Integer','Float','Float64','Bool','Char','string'].includes(needle.kind))) return;
  if (needle.kind === 'string' && needle.children.some(n => n.interior)) return;
  if (m.lookup('in', m.scopeFor(node))?.kind !== 'builtin') return;
  suggest(context, node, 'Consider membership testing; custom equality, missing and collection membership may differ.', `(${text(source, needle)} in ${text(source, args[1])})`);
} }));
