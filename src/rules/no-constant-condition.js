import { defineRule, isOpaque } from './common.js';
const numeric = new Set(['Integer', 'BinInt', 'OctInt', 'HexInt', 'Float', 'Float32']);
function literal(n) {
  while (n.kind === 'parens' && n.children.length === 1) n = n.children[0];
  if (!n.interior && (n.kind === 'Bool' || n.kind === 'Char' || numeric.has(n.kind))) return n;
  if (n.kind === 'char' && n.interior && n.children.length === 1 && n.children[0].kind === 'Char') return n;
  if (n.kind === 'string' && n.interior && n.children.every(c => !c.interior && c.kind === 'String')) return n;
  return null;
}
export default defineRule({
  meta: { type: 'problem', schema: [{ type: 'object', properties: { checkInfiniteLoops: { type: 'boolean' }, checkWhileTrue: { type: 'boolean' }, checkTernary: { type: 'boolean' } }, additionalProperties: false }], docs: { description: 'Report literal conditions, allowing while true by default.' }, messages: { issue: 'Literal condition is {{reason}}.' } },
  create(context) {
    const opts = context.options[0] ?? {};
    function check(node) {
      if (!node.interior || isOpaque(node, context.sourceCode) || node.kind === '?' && opts.checkTernary === false) return;
      const value = literal(node.children[0]);
      if (!value) return;
      if (node.kind === 'while' && value.kind === 'Bool' && value.value === 'true' && !(opts.checkInfiniteLoops ?? opts.checkWhileTrue ?? false)) return;
      context.report({ node: node.children[0], messageId: 'issue', data: { reason: value.kind === 'Bool' ? 'constant' : 'not a Bool' } });
    }
    return { if: check, elseif: check, while: check, '[kind="?"]': check };
  },
});
