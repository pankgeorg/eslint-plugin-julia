import { rule, ordinary, binary, strip, text, suggest, baseAvailable } from './idiom-common.js';
export default rule('Suggest isnan for comparisons with known NaN constants.', {
  identity: { type: 'boolean' },
}, (context, m, source, options) => ({ call(node) {
  const parts = binary(node);
  if (!parts || !ordinary(node, source)) return;
  if (!m.isUnshadowedBuiltin(parts[1], parts[1].value)) return;
  const [a, op, b] = parts;
  if (!['==', '!=', ...(options.identity === false ? [] : ['===', '!=='])].includes(op.value)) return;
  const nan = n => ['NaN', 'NaN16', 'NaN32'].some(name => m.isUnshadowedBuiltin(strip(n), name));
  const operand = nan(a) ? b : nan(b) ? a : null;
  if (!operand) return;
  const replacement = `${['!=', '!=='].includes(op.value) ? '!' : ''}Base.isnan(${text(source, operand)})`;
  suggest(context, node, 'Use isnan to test for NaN; equality and identity have different NaN semantics.', baseAvailable(m, node) ? replacement : null);
} }));
