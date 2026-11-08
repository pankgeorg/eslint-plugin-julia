import { defineRule } from './common.js';
import { getScopeManager, identifierName } from '../scope.js';
export default defineRule({
  meta: { type: 'suggestion', hasSuggestions: true, docs: { description: 'Suggest const for singly assigned globals read by functions.' },
    schema: [{ type: 'object', properties: { dynamicScopes: { enum: ['skip', 'strict-file'] },
      mutableGlobals: { type: 'array', items: { type: 'string' } }, initializers: { enum: ['literals', 'all'] } }, additionalProperties: false }],
    messages: { constant: 'Global "{{name}}" is assigned once and read inside a function; consider const.',
      add: 'Declare this global const (review external rebindings).' } },
  create(context) { return { JuliaFile() {
    const source = context.sourceCode, m = getScopeManager(source), o = context.options[0] ?? {}, mutable = new Set(o.mutableGlobals);
    const signatureRanges = new Map(m.functions.map(fn => [fn.scope, fn.node.children[0].range]));
    function literal(n) {
      if (!n.interior) return ['Integer', 'Float', 'Float32', 'Float64', 'Bool', 'Char'].includes(n.kind);
      if (n.kind === 'string') return n.children.every(c => !c.interior && c.kind === 'String');
      return ['tuple', 'vect', 'parens'].includes(n.kind) && n.children.every(literal);
    }
    for (const s of m.scopes.filter(s => s.kind === 'module')) for (const b of s.bindings.values()) {
      if (b.constant || b.writes.length !== 1 || mutable.has(b.name) || b.definitions.some(d => d.kind !== 'assignment' && !(d.kind === 'declaration' && d.declaration === 'global') || d.typed || d.opaque)) continue;
      if (o.dynamicScopes !== 'strict-file' && (s.bareUsing.length || m.scopes.some(n => n.module === s && n.dynamic))) continue;
      const d = b.writes[0], assignment = d.assignment;
      if (d.scope !== s || identifierName(assignment.children[0]) === null) continue;
      if (o.initializers === 'literals' && !literal(assignment.children[1])) continue;
      let direct = true;
      for (let at = source.getParent(assignment); at && at !== s.node; at = source.getParent(at))
        if (!['JuliaFile', 'block', 'toplevel'].includes(at.kind)) direct = false;
      if (!direct) continue;
      if (!b.references.some(r => { for (let at = r.scope; at && at !== s; at = at.parent) if (at.kind === 'function') {
        const sig = signatureRanges.get(at);
        if (!sig || r.node.range[0] < sig[0] || r.node.range[1] > sig[1]) return true;
      } return false; })) continue;
      context.report({ node: d.node, messageId: 'constant', data: { name: b.name },
        suggest: [{ messageId: 'add', fix: fixer => fixer.insertTextBefore(source.getTokenAfter({ range: [assignment.range[0], assignment.range[0]] }), 'const ') }] });
    }
  } }; },
});
