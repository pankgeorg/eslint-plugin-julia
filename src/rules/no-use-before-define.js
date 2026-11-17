import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Report local reads before straight-line initialization.' },
    schema: [
      {
        type: 'object',
        properties: {
          checkGlobals: { type: 'boolean' },
          functions: { type: 'boolean' },
          dynamicInitialization: { enum: ['strict', 'ignore-containing-scope'] },
        },
        additionalProperties: false,
      },
    ],
    messages: { before: 'Local "{{name}}" is read before its first definition.' },
  },
  create(context) {
    return {
      JuliaFile() {
        const source = context.sourceCode,
          m = getScopeManager(source),
          o = context.options[0] ?? {};
        const signatures = new Map(m.functions.map((fn) => [fn.scope, fn.node.children[0].range]));
        const barriers = new Set(['if', 'elseif', 'while', 'for', 'try', 'catch', '&&', '||', '?']);
        function barrier(node) {
          const pending = [node];
          while (pending.length) {
            const n = pending.pop();
            if (['function', '->', 'do', 'module', 'struct'].includes(n.kind)) continue;
            if (
              barriers.has(n.kind) ||
              ['return', 'break', 'continue', 'generator'].includes(n.kind)
            )
              return true;
            pending.push(...n.children);
          }
          return false;
        }
        function dynamicRegion(s, node) {
          let containing = s;
          for (let at = s; at && at.kind !== 'module'; at = at.parent)
            if (at.kind === 'function') {
              containing = at;
              break;
            }
          return (
            source.getAncestors(node).some((n) => n.kind === 'macrocall') ||
            m.scopes.some((child) => {
              if (
                child.dynamic &&
                child.node.range[0] >= containing.node.range[0] &&
                child.node.range[1] <= containing.node.range[1]
              )
                return true;
              for (let at = child; at; at = at.parent) if (at === containing) return child.dynamic;
              return false;
            })
          );
        }
        function straight(node, s) {
          for (let at = node; at && at !== s.node; at = source.getParent(at)) {
            const parent = source.getParent(at);
            if (barriers.has(at.kind)) return false;
            if (
              parent?.kind === 'block' ||
              parent?.kind === 'toplevel' ||
              parent?.kind === 'JuliaFile'
            ) {
              for (const prev of parent.children) {
                if (prev === at) break;
                if (barrier(prev)) return false;
              }
            }
          }
          return true;
        }
        for (const r of m.references) {
          const b = r.binding;
          if (['signature', 'default'].includes(r.scope.kind)) continue;
          if (!b || b.kind === 'builtin' || r.opaque || b.scope !== r.scope || !r.read) continue;
          if (b.scope.kind === 'module' && !o.checkGlobals) continue;
          if (
            [
              'type-parameter',
              'import',
              'intrinsic',
              'implicit-argument',
              'module-self',
              'module',
              'iteration',
              'catch',
              // declared by a macro: its position isn't known
              'macro-binding',
            ].includes(b.kind)
          )
            continue;
          if (['function', 'macro', 'type'].includes(b.kind) && o.functions !== true) continue;
          if (
            o.dynamicInitialization === 'ignore-containing-scope' &&
            dynamicRegion(r.scope, r.node)
          )
            continue;
          const signature = signatures.get(r.scope);
          if (
            signature &&
            r.node.range[0] >= signature[0] &&
            r.node.range[1] <= signature[1] &&
            source.getAncestors(r.node).some((n) => n.kind === 'macrocall')
          )
            continue;
          if (!straight(r.node, r.scope)) continue;
          const initial = b.definitions
            .filter(
              (d) =>
                ['argument', 'keyword', 'iteration', 'catch', 'function', 'macro', 'type'].includes(
                  d.kind,
                ) ||
                (d.kind === 'let' && d.assignment?.kind === '=') ||
                d.initialized,
            )
            .filter((d) => straight(d.node, d.scope));
          if (
            initial.some(
              (d) =>
                (d.kind === 'assignment' ? d.assignment.range[1] : d.node.range[1]) <=
                r.node.range[0],
            )
          )
            continue;
          // Bare local without an initializer does not initialize. A future local assignment does.
          context.report({ node: r.node, messageId: 'before', data: { name: r.name } });
        }
      },
    };
  },
});
