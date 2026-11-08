import { checkRule, ordinary, nodes, statements, report } from './correctness-common.js';
const barriers = new Set(['if', 'elseif', '?', '&&', '||', 'for', 'while', 'try', 'catch', 'finally',
  'function', 'macro', '->', 'do', 'let', 'generator', 'comprehension', 'macrocall', 'continue', 'return', 'break']);
export default checkRule('Report loops whose straight-line body always exits on its first iteration.', (context, m, source) => {
  function check(node) {
    if (!node.interior || !ordinary(node, source)) return;
    const body = node.children.at(-1);
    if (body?.kind !== 'block') return;
    const parts = statements(body), end = parts.at(-1);
    if (!['break', 'return'].includes(end?.kind)) return;
    if (end.kind === 'return' && !source.getAncestors(node).some(n => ['function', '->', 'do'].includes(n.kind))) return;
    for (const part of parts) for (const n of nodes(part))
      if (n !== end && barriers.has(n.kind)) return;
    report(context, node, 'This loop can execute at most one iteration because its body always exits.');
  }
  return { for: check, while: check };
});
