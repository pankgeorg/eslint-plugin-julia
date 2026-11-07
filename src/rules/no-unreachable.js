import { defineRule, isOpaque } from './common.js';
const containers = new Set(['block', 'toplevel', 'JuliaFile']);
const functions = new Set(['function', 'macro', '->', 'do']);
const declarations = new Set(['function', 'macro', 'struct', 'module', 'baremodule', 'const', 'global', 'local', 'using', 'import', 'export', 'public']);
function flatten(node) {
  const result = [], stack = [...node.children].reverse();
  while (stack.length) {
    const n = stack.pop();
    if (n.interior && containers.has(n.kind)) stack.push(...n.children.toReversed());
    else result.push(n);
  }
  return result;
}
function hasMacro(node) {
  const stack = [node];
  while (stack.length) {
    const n = stack.pop();
    if (n.kind === 'macrocall') return true;
    if (n !== node && (functions.has(n.kind) || ['quote', 'inert'].includes(n.kind))) continue;
    stack.push(...n.children);
  }
  return false;
}
function hasTarget(node, source) {
  for (let child = node, p = source.getParent(child); p; child = p, p = source.getParent(p)) {
    if (functions.has(p.kind)) return node.kind === 'return';
    if (node.kind !== 'return' && ['for', 'while'].includes(p.kind) && p.children.at(-1) === child) return true;
  }
  return false;
}
export default defineRule({
  meta: { type: 'problem', schema: [], docs: { description: 'Report statements after an unconditional syntax exit.' }, messages: { issue: 'Unreachable statement after an unconditional exit.' } },
  create(context) {
    const source = context.sourceCode;
    function check(node) {
      if (!node.interior && node.kind !== 'JuliaFile' || isOpaque(node, source)) return;
      if (containers.has(source.getParent(node)?.kind) || hasMacro(node)) return;
      let terminated = false;
      for (const statement of flatten(node)) {
        if (terminated && !declarations.has(statement.kind)) context.report({ node: statement, messageId: 'issue' });
        if (['return', 'break', 'continue'].includes(statement.kind) && hasTarget(statement, source)) terminated = true;
      }
    }
    return { block: check, toplevel: check, JuliaFile: check };
  },
});
