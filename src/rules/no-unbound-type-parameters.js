import { defineRule } from './common.js';
import { getScopeManager, identifierName } from '../scope.js';
export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Report where parameters absent from positional dispatch types.' },
    schema: [
      {
        type: 'object',
        properties: {
          ignoreParameters: { type: 'array', items: { type: 'string' } },
          checkKeywords: { type: 'boolean' },
          checkComplexSignatures: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unbound: 'Type parameter "{{name}}" occurs in no positional dispatch type or live bound.',
    },
  },
  create(context) {
    return {
      JuliaFile() {
        const m = getScopeManager(context.sourceCode),
          o = context.options[0] ?? {},
          ignore = new Set(o.ignoreParameters);
        const within = (n, range) => n.range[0] >= range[0] && n.range[1] <= range[1];
        for (const fn of m.functions) {
          if (
            fn.node.kind !== 'function' ||
            !fn.call ||
            identifierName(fn.call.children[0]) === null
          )
            continue;
          const params = m.definitions.filter(
            (d) => d.scope === fn.scope && d.kind === 'type-parameter',
          );
          if (!params.length) continue;
          const args = fn.call.children.slice(1),
            positional = args.filter((n) => n.kind !== 'parameters');
          if (!o.checkComplexSignatures && positional.some((n) => ['=', '...'].includes(n.kind)))
            continue;
          const types = [];
          for (let arg of o.checkKeywords
            ? args.flatMap((n) => (n.kind === 'parameters' ? n.children : [n]))
            : positional) {
            while (
              ['=', '...', 'parens'].includes(arg.kind) ||
              (arg.kind === 'macrocall' &&
                ['@nospecialize', '@specialize'].includes(identifierName(arg.children[0])))
            )
              arg = arg.kind === 'macrocall' ? arg.children.at(-1) : arg.children[0];
            while (arg?.kind === '::') {
              types.push(arg.children.at(-1));
              arg = arg.children.length === 2 ? arg.children[0] : null;
            }
          }
          const live = new Set();
          for (const d of params)
            if (
              m.references.some(
                (r) => r.binding === d.binding && types.some((n) => within(r.node, n.range)),
              )
            )
              live.add(d.binding);
          let changed;
          do {
            changed = false;
            for (const d of params)
              if (live.has(d.binding))
                for (const r of m.references) {
                  if (
                    r.binding?.kind === 'type-parameter' &&
                    params.some((p) => p.binding === r.binding) &&
                    within(r.node, d.parameter.range) &&
                    !live.has(r.binding)
                  ) {
                    live.add(r.binding);
                    changed = true;
                  }
                }
          } while (changed);
          for (const d of params)
            if (!live.has(d.binding) && !ignore.has(d.name))
              context.report({ node: d.node, messageId: 'unbound', data: { name: d.name } });
        }
      },
    };
  },
});
