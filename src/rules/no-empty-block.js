import { defineRule, isOpaque } from './common.js';
function empty(body) {
  const stack = [body];
  while (stack.length) {
    const n = stack.pop();
    if (!n.interior || !['block', 'toplevel'].includes(n.kind)) return false;
    stack.push(...n.children);
  }
  return true;
}
export default defineRule({
  meta: { type: 'suggestion', schema: [{ type: 'object', properties: { allowComment: { type: 'boolean' }, allowEmptyWhile: { type: 'boolean' } }, additionalProperties: false }], docs: { description: 'Report empty executable control-flow and let bodies.' }, messages: { issue: 'Empty {{kind}} body.' } },
  create(context) {
    const source = context.sourceCode, options = context.options[0] ?? {};
    function check(node) {
      if (!node.interior || isOpaque(node, source) || node.kind === 'while' && options.allowEmptyWhile) return;
      const bodies = ['if', 'elseif'].includes(node.kind) ? node.children.slice(1).filter(n => n.kind === 'block') : [node.children.at(-1)];
      for (const body of bodies) {
        if (body?.kind !== 'block' || !empty(body)) continue;
        if ((options.allowComment ?? true) && source.comments.some(c => c.range[0] >= body.range[0] && c.range[1] <= body.range[1])) continue;
        context.report({ node: body, messageId: 'issue', data: { kind: node.kind } });
      }
    }
    return { if: check, elseif: check, for: check, while: check, let: check };
  },
});
