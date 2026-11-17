import {
  checkRule,
  ordinary,
  strip,
  localSymbol,
  nodes,
  identifierName,
  report,
} from './correctness-common.js';
export default checkRule(
  'Report eval of a local symbol without an established module global.',
  (context, m, source) => ({
    call(node) {
      if (!ordinary(node, source)) return;
      const head = strip(node.children[0]);
      const name = identifierName(head?.kind === '.' ? head.children[1] : head);
      if (name !== 'eval') return;
      const symbol = node.children.at(-1);
      if (
        symbol?.kind !== 'quote' ||
        symbol.children.length !== 1 ||
        symbol.children[0].kind !== 'Identifier'
      )
        return;
      const scope = m.scopeFor(node),
        module = scope?.module;
      if (!module || module.bare) return;
      const args = node.children.slice(1);
      const ownEval = identifierName(head) === 'eval' && m.isUnshadowedBuiltin(head, 'eval');
      const coreEval =
        head.kind === '.' &&
        m.isUnshadowedBuiltin(head.children[0], 'Core') &&
        args.length === 2 &&
        args[0].kind === 'macrocall' &&
        args[0].children.length === 1 &&
        identifierName(args[0].children[0]) === '@__MODULE__' &&
        m.lookup('@__MODULE__', scope)?.kind === 'builtin';
      if (!(ownEval && args.length === 1) && !coreEval) return;
      const binding = localSymbol(args.at(-1), node, m);
      if (!binding || m.lookup(binding.name, module)) return;
      const models = m.moduleResolution?.scopes.get(module);
      if (
        !models?.length ||
        models.some(
          (model) => model.unknown.size || model.unknownExports || model.unresolvedIncludes,
        )
      )
        return;
      // The resolver marks this call itself as dynamic evaluation. Inspect the visible
      // source instead, rejecting every other dynamic writer and every include.
      // Included files cannot establish absence of a future dynamic global reliably.
      for (const n of nodes(module.node)) {
        if (n === node) continue;
        if (['macrocall', 'include', 'global'].includes(n.kind)) {
          if (coreEval && n === args[0]) continue;
          return;
        }
        if (n.kind !== 'call') continue;
        const h = strip(n.children[0]),
          spelling = identifierName(h?.kind === '.' ? h.children[1] : h);
        if (
          [
            'eval',
            'include',
            'include_string',
            'setglobal!',
            'setglobalonce!',
            'modifyglobal!',
            'swapglobal!',
            'replaceglobal!',
          ].includes(spelling)
        )
          return;
      }
      // Reject globals introduced through any include, even one with known exports.
      if (models.some((model) => model.dynamicEvaluation && m.moduleResolution.files.length > 1))
        return;
      report(
        context,
        node,
        `eval looks up module globals, not the local binding "${binding.name}".`,
      );
    },
  }),
);
