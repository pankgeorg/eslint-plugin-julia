import { checkRule, ordinary, strip, smallInteger, statements, nodes, report } from './correctness-common.js';
export default checkRule('Report overwritten stores to fresh local integer vectors.', (context, m, source) => ({ block(node) {
  if (!node.interior || !ordinary(node, source)) return;
  // Only an ordinary function's outer block: no branch or exception regions.
  const fn = source.getParent(node);
  if (fn?.kind !== 'function' || fn.children.at(-1) !== node) return;
  const parts = statements(node);
  if ([...nodes(node)].some(n => ['macrocall', 'function', '->', 'do', 'try', 'if', 'for', 'while', 'let'].includes(n.kind))) return;
  for (let i = 0; i + 2 < parts.length; i++) {
    const [init, first, second] = parts.slice(i, i + 3);
    if (![init, first, second].every(n => n.kind === '=' && n.children.length === 2)) continue;
    const [name, value] = init.children, vector = strip(value);
    if (vector.kind !== 'vect' || !vector.children.length || vector.children.some(n => smallInteger(n) === null)
      || strip(first.children[0]).kind !== 'ref' || strip(second.children[0]).kind !== 'ref') continue;
    const binding = m.resolve(name);
    if (!binding || binding.scope.kind !== 'function' || binding.definitions.length !== 1) continue;
    // Captures and prior aliases are outside the fresh, uncaptured subset.
    if (binding.references.some(r => r.scope !== binding.scope || r.node.range[0] < init.range[0])) continue;
    const a = strip(first.children[0]), b = strip(second.children[0]);
    if (a.kind !== 'ref' || b.kind !== 'ref' || a.children.length !== 2 || b.children.length !== 2
      || m.resolve(a.children[0]) !== binding || m.resolve(b.children[0]) !== binding) continue;
    const index = smallInteger(a.children[1]);
    if (index === null || index < 1 || index > vector.children.length || smallInteger(b.children[1]) !== index
      || smallInteger(first.children[1]) === null || smallInteger(second.children[1]) === null) continue;
    report(context, first, 'This fresh vector element is overwritten immediately before it can be read.');
  }
} }));
