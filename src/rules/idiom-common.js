import { defineRule, isOpaque, isSignature } from './common.js';
import { getScopeManager, identifierName } from '../scope.js';
import { isInfixCall } from '../parser/flags.js';
export { identifierName };
export const strip = (n) =>
  n?.kind === 'parens' && n.children.length === 1 ? strip(n.children[0]) : n;
export function span(source, node) {
  const first = source.getTokenAfter({ range: [node.range[0], node.range[0]] });
  const last = source.getTokenBefore({ range: [node.range[1], node.range[1]] });
  return first && last ? [first.range[0], last.range[1]] : node.range;
}
export const text = (source, node) => source.text.slice(...span(source, node));
export const ordinary = (n, source) => !isOpaque(n, source) && !isSignature(n, source);
export function call(node, name, m) {
  node = strip(node);
  if (node?.kind !== 'call' || isInfixCall(node)) return null;
  let head = strip(node.children[0]);
  if (head?.kind === 'curly') head = head.children[0];
  return m.isUnshadowedBuiltin(head, name) ? node.children.slice(1) : null;
}
export function binary(node) {
  node = strip(node);
  if (node?.kind === '<:' && node.children.length === 2)
    return [node.children[0], { value: '<:' }, node.children[1]];
  return isInfixCall(node) && node.children.length === 3 ? node.children : null;
}
export function* nodes(root) {
  const pending = [root];
  while (pending.length) {
    const n = pending.pop();
    yield n;
    pending.push(...n.children.toReversed());
  }
}
export function baseAvailable(m, node) {
  const b = m.lookup('Base', m.scopeFor(node));
  return (
    b?.kind === 'builtin' ||
    b?.definitions.some(
      (d) =>
        d.kind === 'import' && d.moduleName === 'Base' && !b.writes.length && d.name === 'Base',
    )
  );
}
export function suggest(context, node, message, replacement) {
  const range = span(context.sourceCode, node);
  const comments = context.sourceCode.comments.some(
    (c) => c.range[0] >= range[0] && c.range[1] <= range[1],
  );
  context.report({
    node,
    loc: {
      start: context.sourceCode.getLocFromIndex(range[0]),
      end: context.sourceCode.getLocFromIndex(range[1]),
    },
    messageId: 'diagnostic',
    data: { message },
    ...(replacement &&
      !comments && {
        suggest: [
          {
            messageId: 'replace',
            data: { message: `Use ${replacement}.` },
            fix: (fixer) => fixer.replaceTextRange(range, replacement),
          },
        ],
      }),
  });
}
export function rule(description, properties, create, hasSuggestions = true) {
  return defineRule({
    meta: {
      type: 'suggestion',
      hasSuggestions,
      docs: { description },
      schema: [{ type: 'object', properties, additionalProperties: false }],
      messages: { diagnostic: '{{message}}', replace: '{{message}}' },
    },
    create(context) {
      return create(
        context,
        getScopeManager(context.sourceCode, context),
        context.sourceCode,
        context.options[0] ?? {},
      );
    },
  });
}
export function integer(node) {
  node = strip(node);
  if (node?.kind !== 'Integer') return null;
  try {
    return BigInt(node.value.replaceAll('_', ''));
  } catch {
    return null;
  }
}
export function sameName(a, b, m) {
  a = strip(a);
  b = strip(b);
  if (identifierName(a) === null || identifierName(b) === null) return false;
  const x = m.resolve(a),
    y = m.resolve(b);
  return x && y ? x === y : identifierName(a) === identifierName(b);
}
export function booleanUse(node, source) {
  let parent = source.getParent(node);
  while (parent?.kind === 'parens') {
    node = parent;
    parent = source.getParent(node);
  }
  return (
    (['if', 'elseif', 'while', '?'].includes(parent?.kind) && parent.children[0] === node) ||
    (['&&', '||'].includes(parent?.kind) && parent.children.at(-1) !== node)
  );
}
