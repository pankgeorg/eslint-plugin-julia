import { check, ordinary, binary, strip, identifierName, hasCaptureOrOpaqueUse } from './semantic-common.js';
export default check('Report identity comparisons of the same stable local binding.', (context, m, source) => ({ call(node) {
  const p = binary(node);
  if (!p || !ordinary(node, source)) return;
  const [a, op, b] = p;
  if (!['===', '!=='].includes(op.value) || !m.isUnshadowedBuiltin(op, op.value)) return;
  const left = strip(a), right = strip(b);
  if (identifierName(left) === null || identifierName(right) === null) return;
  const binding = m.resolve(left);
  if (!binding?.scope || binding.scope.kind === 'module' || binding !== m.resolve(right) || hasCaptureOrOpaqueUse(binding, source)) return;
  context.report({ node, messageId: 'diagnostic', data: { message: `Comparing this local binding with itself using ${op.value} is always ${op.value === '==='}.` } });
} }));
