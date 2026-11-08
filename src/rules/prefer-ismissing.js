import { rule, ordinary, binary, strip, text, suggest, baseAvailable, booleanUse } from './idiom-common.js';
export default rule('Suggest ismissing for equality comparisons with missing.', { onlyConditions: { type: 'boolean' } }, (context, m, source, options) => ({ call(node) {
  const parts = binary(node);
  if (!parts || !ordinary(node, source) || options.onlyConditions && !booleanUse(node, source)) return;
  if (!m.isUnshadowedBuiltin(parts[1], parts[1].value)) return;
  const [a, op, b] = parts;
  if (!['==', '!='].includes(op.value)) return;
  const operand = m.isUnshadowedBuiltin(strip(a), 'missing') ? b : m.isUnshadowedBuiltin(strip(b), 'missing') ? a : null;
  if (!operand) return;
  suggest(context, node, 'Use ismissing to test for missing; equality propagates missing.', baseAvailable(m, node)
    ? `${op.value === '!=' ? '!' : ''}Base.ismissing(${text(source, operand)})` : null);
} }));
