import { defineRule } from './common.js';
import { getScopeManager, identifierName } from '../scope.js';
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: { description: 'Disallow assignment of a binding or property to itself.' },
    messages: { self: 'Assignment repeats the same binding or property.' },
  },
  create(context) {
    const source = context.sourceCode;
    let m;
    const assignments = new Map();
    const unwrap = (n) =>
      n?.kind === 'parens' && n.children.length === 1 ? unwrap(n.children[0]) : n;
    function same(a, b, receiver = false) {
      a = unwrap(a);
      b = unwrap(b);
      if (identifierName(a) !== null && identifierName(b) !== null) {
        if (a.kind === 'var') a = a.children[0];
        if (b.kind === 'var') b = b.children[0];
        const binding = m.resolve(a);
        return (
          binding !== null &&
          binding === m.resolve(b) &&
          (receiver || !binding.definitions.some((d) => d.typed))
        );
      }
      if (a?.kind === '.' && b?.kind === '.')
        return (
          same(a.children[0], b.children[0], true) &&
          identifierName(a.children[1]) === identifierName(b.children[1])
        );
      return (
        a?.kind === 'tuple' &&
        b?.kind === 'tuple' &&
        a.children.length === b.children.length &&
        a.children.every((n, i) => same(n, b.children[i]))
      );
    }
    return {
      JuliaFile() {
        m = getScopeManager(source);
        for (const d of m.definitions) assignments.set(d.assignment, d);
      },
      '[kind="="]'(node) {
        if (!node.interior) return;
        const d = assignments.get(node);
        if (!d || d.kind !== 'assignment') {
          // Property writes create no binding definition; only executable assignments qualify.
          let receiver = node.children[0];
          if (receiver?.kind !== '.') return;
          while (receiver.kind === '.') receiver = receiver.children[0];
          if (!m.referenceFor(receiver)) return;
          for (let at = source.getParent(node); at; at = source.getParent(at)) {
            if (['function', '->', 'do'].includes(at.kind)) break;
            if (at.kind === 'macrocall') return;
          }
        }
        if (d?.kind === 'let' || d?.constant || d?.typed || d?.opaque) return;
        if (same(...node.children)) context.report({ node, messageId: 'self' });
      },
    };
  },
});
