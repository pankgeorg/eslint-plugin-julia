import { ordinary, strip, binary, call, nodes } from './idiom-common.js';
import { localBinding, within, emptyArray, positional } from './performance-common.js';

// Deliberately accept only an adjacent initializer and straight-line loop body.
// This is lexical recurrence recognition, not type or escape analysis.
export function growth(node, kind, m, source) {
  if (!ordinary(node, source)) return [];
  const block = source.getParent(node),
    index = block?.children.indexOf(node),
    init = block?.children[index - 1];
  if (block?.kind !== 'block' || init?.kind !== '=') return [];
  const binding = localBinding(init.children[0], m),
    initial = strip(init.children[1]),
    body = node.children.at(-1);
  if (!binding || body.kind !== 'block') return [];
  if (
    kind === 'string'
      ? initial.kind !== 'string' || initial.children.some((n) => n.kind !== 'String')
      : !emptyArray(initial, m)
  )
    return [];
  const forbidden = [
    'macrocall',
    'quote',
    'inert',
    'function',
    '->',
    'do',
    'generator',
    'for',
    'while',
    'if',
    'elseif',
    '?',
    '&&',
    '||',
    'try',
    'return',
    'break',
    'continue',
    'let',
    'local',
    'global',
  ];
  if ([...nodes(body)].some((n) => forbidden.includes(n.kind))) return [];
  const recurrences = [];
  for (const statement of body.children) {
    if (m.resolve(statement.children[0]) !== binding) continue;
    if (
      kind === 'string' &&
      statement.kind === 'op=' &&
      m.isUnshadowedBuiltin(statement.children[1], '*')
    ) {
      recurrences.push({ statement, read: statement.children[0] });
      continue;
    }
    if (statement.kind !== '=') continue;
    const rhs = strip(statement.children[1]);
    if (kind === 'string') {
      const parts = binary(rhs);
      if (parts && m.isUnshadowedBuiltin(parts[1], '*') && m.resolve(strip(parts[0])) === binding)
        recurrences.push({ statement, read: strip(parts[0]) });
    } else {
      const args = call(rhs, 'vcat', m) ?? call(rhs, 'hcat', m);
      if (positional(args) && args.length === 2 && m.resolve(strip(args[0])) === binding)
        recurrences.push({ statement, read: strip(args[0]) });
    }
  }
  if (
    !recurrences.length ||
    binding.definitions.length !== recurrences.length + 1 ||
    binding.definitions.some(
      (d) => d.assignment !== init && !recurrences.some((r) => r.statement === d.assignment),
    )
  )
    return [];
  const refs = binding.references.filter((r) => within(r.node, node));
  if (
    refs.length !== recurrences.length ||
    refs.some((r) => !recurrences.some((candidate) => candidate.read === r.node))
  )
    return [];
  // Captured prefixes may be observed indirectly through a callback.
  if (
    binding.references.some((r) => {
      for (let at = r.scope; at && at !== binding.scope; at = at.parent)
        if (at.kind === 'function') return true;
      return false;
    })
  )
    return [];
  return recurrences.map((r) => r.statement);
}
