import { defineRule, isOpaque } from './common.js';
import { getScopeManager } from '../scope.js';
import { within } from './performance-common.js';

export default defineRule({
  meta: {
    type: 'suggestion', docs: { description: 'Require a type for rebound globals read inside functions.' },
    schema: [{ type: 'object', additionalProperties: false, properties: {
      allow: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    } }],
    defaultOptions: [{ allow: [] }],
    messages: { typed: 'Global "{{name}}" is rebound and read inside a function; consider a typed global (Julia 1.8 or newer).' },
  },
  create(context) {
    return { JuliaFile() {
      const source = context.sourceCode, m = getScopeManager(source), allowed = new Set(context.options[0]?.allow);
      const bodies = new Map(m.functions.map(fn => [fn.scope, fn.node.children[1]]));
      function inFunctionBody(record) {
        if (record.opaque || isOpaque(record.node, source)) return false;
        for (let s = record.scope; s && s.kind !== 'module'; s = s.parent)
          if (bodies.has(s) && within(record.node, bodies.get(s))) return true;
        return false;
      }
      for (const s of m.scopes.filter(s => s.kind === 'module')) for (const b of s.bindings.values()) {
        if (b.scope !== s || b.constant || allowed.has(b.name) || !b.writes.length) continue;
        if (b.definitions.some(d => d.typed || d.opaque || isOpaque(d.node, source)
          || d.kind !== 'assignment' && !(d.kind === 'declaration' && d.declaration === 'global'))) continue;
        // A sole module write belongs to prefer-const-global. A function write
        // can execute repeatedly, even if there is just one written assignment.
        if (b.writes.length < 2 && !b.writes.some(inFunctionBody)) continue;
        if (!b.references.some(r => r.read && inFunctionBody(r))) continue;
        context.report({ node: b.writes[0].node, messageId: 'typed', data: { name: b.name } });
      }
    } };
  },
});
