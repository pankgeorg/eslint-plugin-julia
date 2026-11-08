import { defineRule } from './common.js';
import { strip, span } from './idiom-common.js';
import { isInfixCall } from '../parser/flags.js';
import { getScopeManager, identifierName } from '../scope.js';
export { identifierName };
export { strip, nodes, ordinary, text, span, binary, baseAvailable } from './idiom-common.js';

// These checks need the physical file and entry-file settings for module facts.
export function checkRule(description, create, suggestions = false) {
  return defineRule({ meta: { type: 'problem', docs: { description }, schema: [],
    hasSuggestions: suggestions,
    messages: { issue: '{{message}}', replace: '{{message}}' } },
    create(context) {
      let manager;
      const lazy = new Proxy({}, { get(_, key) {
        manager ??= getScopeManager(context.sourceCode, context);
        const value = manager[key];
        return typeof value === 'function' ? value.bind(manager) : value;
      } });
      return create(context, lazy, context.sourceCode);
    } });
}
export function report(context, node, message, replacement) {
  const source = context.sourceCode;
  const comments = source.comments.some(c => c.range[0] >= node.range[0] && c.range[1] <= node.range[1]);
  context.report({ node, messageId: 'issue', data: { message },
    ...(replacement && !comments && { suggest: [{ messageId: 'replace', data: { message: `Use ${replacement}.` },
      fix: fixer => fixer.replaceTextRange(span(source, node), replacement) }] }) });
}
export function smallInteger(node) {
  while (node?.kind === 'parens' && node.children.length === 1) node = node.children[0];
  if (node?.kind !== 'Integer' || !/^-?[0-9][0-9_]*$/u.test(node.value)) return null;
  const n = Number(node.value.replaceAll('_', ''));
  return Number.isInteger(n) && Math.abs(n) <= 2147483647 ? n : null;
}
export function statements(node) {
  return ['block', 'toplevel'].includes(node.kind) ? node.children.flatMap(statements) : [node];
}
export function localSymbol(node, at, m) {
  if (node?.kind !== 'quote' || node.children.length !== 1 || node.children[0].kind !== 'Identifier') return null;
  const name = identifierName(node.children[0]), scope = m.scopeFor(at);
  const binding = scope && m.lookup(name, scope);
  return binding && !['builtin', 'type-parameter'].includes(binding.kind) && binding.scope.kind !== 'module' ? binding : null;
}

// Match the spelling before requesting potentially expensive module facts.
export function call(node, name, m) {
  node = strip(node);
  if (node?.kind !== 'call' || isInfixCall(node)) return null;
  let head = strip(node.children[0]);
  if (head?.kind === 'curly') head = strip(head.children[0]);
  const spelling = identifierName(head?.kind === '.' ? head.children[1] : head);
  if (spelling !== name) return null;
  return m.isUnshadowedBuiltin(head, name) ? node.children.slice(1) : null;
}
