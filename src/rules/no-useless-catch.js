import { check, ordinary, strip, call } from './semantic-common.js';
export default check('Report catches that only rethrow the active exception.', (context, m, source, options) => ({ catch(node) {
  if (!node.interior || !ordinary(node, source)) return;
  const parent = source.getParent(node);
  if (parent?.kind !== 'try' || parent.children.length !== 2) return;
  const body = node.children.at(-1);
  if (body?.kind !== 'block' || body.children.length !== 1) return;
  const expression = strip(body.children[0]);
  if (strip(expression.children[0])?.kind === 'curly') return;
  const args = call(expression, 'rethrow', m);
  if (!args || args.length) return;
  if (options.allowComment !== false && source.comments.some(c => c.range[0] >= node.range[0] && c.range[1] <= node.range[1])) return;
  context.report({ node, messageId: 'diagnostic', data: { message: 'This catch only rethrows the active exception.' } });
} }), { properties: { allowComment: { type: 'boolean' } } });
