import { defineRule, isOpaque, normalizedTreeKey } from './common.js';
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: { description: 'Report identical nonempty conditional branches.' },
    messages: { issue: 'Conditional branch repeats the body at line {{line}}.' },
  },
  create(context) {
    function check(node) {
      if (!node.interior || isOpaque(node, context.sourceCode)) return;
      const bodies = [];
      if (node.kind === '?') bodies.push(...node.children.slice(1));
      else
        for (let branch = node; branch;) {
          bodies.push(branch.children[1]);
          const tail = branch.children[2];
          if (tail?.kind === 'elseif') branch = tail;
          else {
            if (tail) bodies.push(tail);
            break;
          }
        }
      const nonempty = (n) => n && (n.kind !== 'block' || n.children.length > 0);
      const keys = bodies.map((n) => (nonempty(n) ? normalizedTreeKey(n) : null));
      if (keys.length > 1 && keys[0] !== null && keys.every((k) => k === keys[0])) {
        context.report({ node, messageId: 'issue', data: { line: bodies[0].loc.start.line } });
        return;
      }
      const seen = new Map();
      for (let i = 0; i < bodies.length; i++) {
        if (keys[i] === null) continue;
        if (seen.has(keys[i]))
          context.report({
            node: bodies[i],
            messageId: 'issue',
            data: { line: seen.get(keys[i]) },
          });
        else seen.set(keys[i], bodies[i].loc.start.line);
      }
    }
    return { if: check, '[kind="?"]': check };
  },
});
