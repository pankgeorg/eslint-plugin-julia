import { check, ordinary, binary, call, integer, strip } from './semantic-common.js';
export default check(
  'Report comparisons inconsistent with nonnegative builtin length.',
  (context, m, source, options) => ({
    call(node) {
      const p = binary(node);
      if (!p || !ordinary(node, source)) return;
      let [a, op, b] = p,
        operator = op.value;
      if (
        !['<', '<=', '>', '>=', '==', '!='].includes(operator) ||
        !m.isUnshadowedBuiltin(op, operator)
      )
        return;
      const lengthArgs = (expression) => {
        expression = strip(expression);
        if (strip(expression.children[0])?.kind === 'curly') return null;
        const args = call(expression, 'length', m);
        return args?.length === 1 && !['...', 'parameters'].includes(strip(args[0]).kind)
          ? args
          : null;
      };
      let args = lengthArgs(a),
        bound = integer(b);
      if (!args) {
        args = lengthArgs(b);
        bound = integer(a);
        operator = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '==': '==', '!=': '!=' }[operator];
      }
      if (
        args?.length !== 1 ||
        bound === null ||
        bound > 0n ||
        (bound === 0n && !['<', '>='].includes(operator))
      )
        return;
      const collection = strip(args[0]);
      if (options.knownCollectionsOnly && !['tuple', 'vect', 'string'].includes(collection.kind))
        return;
      const result = ['>', '>=', '!='].includes(operator);
      context.report({
        node,
        messageId: 'diagnostic',
        data: { message: `A nonnegative length makes this comparison always ${result}.` },
      });
    },
  }),
  { properties: { knownCollectionsOnly: { type: 'boolean' } } },
);
