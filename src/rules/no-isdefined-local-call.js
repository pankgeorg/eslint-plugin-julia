import { checkRule, ordinary, call, localSymbol, report } from './correctness-common.js';
export default checkRule(
  'Report one-argument isdefined calls naming lexical locals.',
  (context, m, source) => ({
    call(node) {
      if (
        !ordinary(node, source) ||
        node.children.length !== 2 ||
        node.children[1]?.kind !== 'quote' ||
        node.children[1].children.length !== 1 ||
        node.children[1].children[0].kind !== 'Identifier'
      )
        return;
      const args = call(node, 'isdefined', m);
      if (args?.length !== 1 || !localSymbol(args[0], node, m)) return;
      report(
        context,
        node,
        'isdefined needs an object and field; use @isdefined(name) to test a local binding.',
      );
    },
  }),
);
