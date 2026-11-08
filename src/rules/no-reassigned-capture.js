import { defineRule, isOpaque } from './common.js';
import { getLocalScopeManager } from '../scope.js';

// A generator body and its filters lower to closures; its first iterable does
// not. ScopeManager deliberately models generator scopes without claiming that
// all their children execute inside the generated function.
function boundary(record, binding, source) {
  for (let s = record.scope; s && s !== binding.scope; s = s.parent) {
    if (s.kind === 'module') return null;
    if (s.kind === 'function') return s.node.kind === 'macro' ? null : s.node;
    const typedLoop = s.kind === 'comprehension' && source.getParent(s.node)?.kind === 'typed_comprehension'
      && s.node.children.length === 2 && s.node.children[1].kind === 'iteration';
    if (s.kind === 'comprehension' && !typedLoop) {
      let child = record.node;
      for (let p = source.getParent(child); p && p !== s.node; p = source.getParent(child)) child = p;
      if (child === s.node.children[0]) return s.node;
      for (let p = record.node; p && p !== s.node; p = source.getParent(p)) {
        const parent = source.getParent(p);
        if (parent?.kind === 'filter' && parent.children[0] !== p) return s.node;
      }
    }
  }
  return null;
}
function straightBefore(write, capture, source) {
  if (write.assignment.range[1] > capture.range[0]) return false;
  // Julia 1.13 can move one unconditional argument/iteration-variable assignment
  // into an unboxed local when it dominates every capture in its branch.
  let loop = write.binding.kind === 'iteration' ? write.binding.scope.node : null;
  while (loop && !['for', 'generator'].includes(loop.kind)) loop = source.getParent(loop);
  for (let p = source.getParent(write.assignment); p; p = source.getParent(p)) {
    if (p === loop) return true;
    if (['block', 'parens'].includes(p.kind) && p.range[0] <= capture.range[0] && p.range[1] >= capture.range[1]) return true;
    if (p === capture) return false;
    if (['function', '->', 'do'].includes(p.kind)) return true;
    if (!['block', 'parens', 'local', '::'].includes(p.kind)) return false;
  }
  return false;
}
export default defineRule({
  meta: { type: 'suggestion', docs: { description: 'Review reassigned local captures that require boxing during lowering.' },
    schema: [], messages: { boxed: 'Captured local "{{name}}" is reassigned and requires a box during lowering. Review this capture on performance-sensitive paths.' } },
  create(context) {
    const source = context.sourceCode;
    return { JuliaFile() {
      const manager = getLocalScopeManager(source), seen = new Set();
      for (const scope of manager.scopes) for (const binding of scope.bindings.values()) {
        if (seen.has(binding)) continue;
        seen.add(binding);
        if (!binding.scope || binding.scope.kind === 'module' || binding.constant
          || ['function', 'macro', 'type', 'type-parameter', 'import'].includes(binding.kind)) continue;
        // This is a source-level subset, not a macro expansion/lowering emulator.
        const records = [...binding.definitions, ...binding.references];
        if (records.some(r => r.opaque || isOpaque(r.node, source))) continue;
        const captures = records.map(r => ({ record: r, closure: boundary(r, binding, source) }))
          .filter(c => c.closure).sort((a, b) => a.record.node.range[0] - b.record.node.range[0]);
        if (!captures.length) continue;
        const writes = binding.writes.filter(w => w.assignment);
        const capturedWrite = writes.some(w => boundary(w, binding, source));
        const letInitializer = binding.definitions.some(d => d.kind === 'let' && d.assignment?.kind === '=');
        const count = writes.length + Number(letInitializer);
        let boxed = capturedWrite || count > 1;
        if (!boxed && writes.length === 1 && ['argument', 'keyword', 'iteration'].includes(binding.kind))
          boxed = captures.some(c => !straightBefore(writes[0], c.closure, source));
        if (boxed) context.report({ node: captures[0].record.node, messageId: 'boxed', data: { name: binding.name } });
      }
    } };
  },
});
