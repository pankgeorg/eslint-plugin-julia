import { defineRule } from './common.js';
import { getScopeManager, identifierName } from '../scope.js';
import { ordinary, strip, call } from './idiom-common.js';
import { precedes, rangeCount } from './performance-common.js';

const fillers = ['push!', 'append!', 'pushfirst!', 'prepend!'];
function functionScope(scope) {
  for (let s = scope; s; s = s.parent) if (['module', 'function'].includes(s.kind)) return s;
  return null;
}
export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Suggest an explicit element type for empty arrays later filled in the same function.',
    },
    schema: [],
    messages: {
      typed:
        'Empty array "{{name}}" is later filled; consider T[] with an appropriate element type instead of Vector{Any}.',
    },
  },
  create(context) {
    const source = context.sourceCode,
      m = getScopeManager(source);
    return {
      vect(node) {
        if (node.children.length || !ordinary(node, source)) return;
        let value = node,
          parent = source.getParent(value);
        while (parent?.kind === 'parens') {
          value = parent;
          parent = source.getParent(value);
        }
        const init = parent;
        if (
          init?.kind !== '=' ||
          init.children[1] !== value ||
          identifierName(init.children[0]) === null
        )
          return;
        const binding = m.resolve(init.children[0]);
        if (
          !binding ||
          binding.definitions.length !== 1 ||
          binding.writes.length !== 1 ||
          binding.definitions[0].opaque
        )
          return;
        // Reserve the adjacent literal-range-loop shape for prefer-sized-push-buffer,
        // including that rule's configurable minimumIterations = 1.
        const block = source.getParent(init),
          next = block?.children[block.children.indexOf(init) + 1];
        if (block?.kind === 'block' && next?.kind === 'for') {
          const clause = next.children[0];
          if (clause?.kind === 'iteration' && clause.children.length === 1) {
            const count = rangeCount(clause.children[0].children[1], m);
            if (count !== null && count > 0n) return;
          }
        }
        const scope = functionScope(m.scopeFor(init));
        const filled = binding.references.some((ref) => {
          if (
            ref.opaque ||
            !ordinary(ref.node, source) ||
            functionScope(ref.scope) !== scope ||
            !precedes(init, ref.node, source)
          )
            return false;
          let receiver = ref.node,
            at = source.getParent(receiver);
          if (at?.kind === 'var') {
            receiver = at;
            at = source.getParent(at);
          }
          while (at?.kind === 'parens') {
            receiver = at;
            at = source.getParent(at);
          }
          return fillers.some((name) => {
            const args = call(at, name, m);
            return args?.length >= 2 && strip(args[0]) === strip(receiver);
          });
        });
        if (filled) context.report({ node, messageId: 'typed', data: { name: binding.name } });
      },
    };
  },
});
