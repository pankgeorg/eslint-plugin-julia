import { defineRule, isBareName, isOpaque } from './common.js';

const boundaries = new Set([
  'function',
  'macro',
  '->',
  'let',
  'module',
  'baremodule',
  'struct',
  'do',
]);
function bindingNames(pattern) {
  const pending = [pattern],
    names = [];
  while (pending.length) {
    const n = pending.pop();
    if (isBareName(n)) {
      if (!/^_+$/u.test(n.value)) names.push(n);
    } else if (n.kind === 'tuple' && n.interior) pending.push(...n.children.toReversed());
    else return []; // outer, typed/unknown patterns are deliberately not inferred.
  }
  return names;
}
function iteration(clause) {
  if (clause?.kind === 'filter' && clause.interior) clause = clause.children[0];
  return clause?.kind === 'iteration' && clause.interior ? clause : null;
}
function namesIn(clause) {
  const iter = iteration(clause);
  if (!iter) return [];
  return iter.children.flatMap((n) =>
    n.kind === 'in' && n.interior && n.children.length === 2 ? bindingNames(n.children[0]) : [],
  );
}
function enclosingNames(node, source) {
  const names = new Set();
  for (
    let child = node, parent = source.getParent(child);
    parent;
    child = parent, parent = source.getParent(parent)
  ) {
    if (boundaries.has(parent.kind)) break;
    if (parent.kind === 'filter' && parent.interior && parent.children.indexOf(child) > 0) {
      for (const n of namesIn(parent.children[0])) names.add(n.value);
    }
    if (parent.kind === 'for' && parent.interior && parent.children[1] === child) {
      for (const n of namesIn(parent.children[0])) names.add(n.value);
    } else if (parent.kind === 'generator' && parent.interior) {
      const index = parent.children.indexOf(child);
      // A generator's first child is its body; later children are successive for
      // clauses. A clause's iterable is outside that clause's binding scope.
      const clauses = parent.children.slice(1, index === 0 ? undefined : index);
      for (const clause of clauses) for (const n of namesIn(clause)) names.add(n.value);
    }
  }
  return names;
}
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: { description: 'Disallow nested loops that reuse an enclosing loop variable.' },
    messages: { shadow: 'Loop variable "{{name}}" shadows an enclosing loop variable.' },
  },
  create(context) {
    function check(node) {
      if (!node.interior || isOpaque(node, context.sourceCode)) return;
      const seen = enclosingNames(node, context.sourceCode);
      const clauses = node.kind === 'for' ? [node.children[0]] : node.children.slice(1);
      for (const clause of clauses) {
        const names = namesIn(clause);
        for (const name of names)
          if (seen.has(name.value)) {
            context.report({ node: name, messageId: 'shadow', data: { name: name.value } });
          }
        // Comma-separated bindings belong to one clause and aren't nested fors.
        for (const name of names) seen.add(name.value);
      }
    }
    return { for: check, generator: check };
  },
});
