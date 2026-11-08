import { defineRule, isBareName, isOpaque } from './common.js';
import { isInfixCall } from '../parser/flags.js';
const sequences = new Set(['block', 'toplevel', 'JuliaFile']);
const numbers = new Set(['Integer', 'BinInt', 'OctInt', 'HexInt', 'Float', 'Float32', 'Bool']);
// A discarded comparison (`x == 1` as a statement) is almost always a typo for `=`, or a
// forgotten `@assert`/`&&`. Overloaded comparison operators with side effects are not a
// pattern worth protecting.
const comparisonOps = new Set(['==', '!=', '===', '!==', '<', '>', '<=', '>=', '≈', '≉', '≠', '≤', '≥', '∈', '∉', 'in', 'isa']);
function isComparison(n) {
  while (n.kind === 'parens' && n.children.length === 1) n = n.children[0];
  if (n.kind === 'comparison') return true;
  return ['call', 'dotcall'].includes(n.kind) && n.interior && n.children.length === 3 && isInfixCall(n)
    && comparisonOps.has(n.children[1].value);
}
function candidate(n) {
  if (isComparison(n)) return true;
  if (isBareName(n)) return n.value !== 'nothing';
  if (!n.interior && numbers.has(n.kind)) return true;
  if (n.kind === 'parens' && n.children.length === 1) return candidate(n.children[0]);
  if (n.kind === 'string') return n.children.every(c => !c.interior && c.kind === 'String');
  if (n.kind === 'char') return n.children.length === 1 && n.children[0].kind === 'Char';
  return n.kind === 'quote' && Boolean(n.flags & 256) && n.children.length === 1 && isBareName(n.children[0]);
}
function discarded(node, source) {
  for (let child = node, p = source.getParent(child); p; child = p, p = source.getParent(p)) {
    if (sequences.has(p.kind)) {
      if (p.children.indexOf(child) < p.children.length - 1) return true;
      continue;
    }
    if (['function', 'macro', '->', 'do', 'module', 'baremodule'].includes(p.kind)) return false;
    if (['for', 'while', 'finally'].includes(p.kind)) return p.children.at(-1) === child;
    if (['if', 'elseif', '?', 'try', 'catch', 'else', 'parens'].includes(p.kind)) continue;
    if (p.kind === 'let' && p.children.at(-1) === child) continue;
    return false;
  }
  return false;
}
export default defineRule({
  meta: { type: 'suggestion', schema: [{ type: 'object', properties: { checkTopLevel: { type: 'boolean' } }, additionalProperties: false }], docs: { description: 'Report simple standalone expressions whose value is definitely discarded.' }, messages: { issue: 'This standalone expression has a discarded value.', comparison: 'This comparison\'s result is discarded (did you mean `=`, or `@assert`?).' } },
  create(context) {
    const source = context.sourceCode;
    const plutoNotebook = /^### A Pluto\.jl notebook ###(?:\r?\n|$)/u.test(source.text);
    function check(node) {
      if (node.kind !== 'JuliaFile' && !node.interior || isOpaque(node, source)) return;
      const parent = source.getParent(node);
      let localContext = false;
      for (let p = node; p; p = source.getParent(p)) {
        if (['string', 'cmdstring'].includes(p.kind)) return;
        if (['function', '->', 'do', 'for', 'while', 'let'].includes(p.kind)) localContext = true;
      }
      // File/module expressions may be outputs of Literate or notebook cells.
      if (!localContext && !context.options[0]?.checkTopLevel) return;
      if (parent?.kind === 'let' && parent.children[0] === node) return;
      for (let p = parent; p; p = source.getParent(p)) {
        if (['function', '->', 'do'].includes(p.kind)) break;
        if (p.kind === 'struct') return;
      }
      for (let i = 0; i < node.children.length; i++) {
        const statement = node.children[i];
        let value = statement;
        while (value.kind === 'parens' && value.children.length === 1) value = value.children[0];
        // Bare reads create reactive dependencies in Pluto notebook cells, and bare literals in
        // cells are display/test scaffolding; comparisons are still reported.
        if (plutoNotebook && !isComparison(value)) continue;
        // Local documentation strings are not always wrapped in a parser doc node.
        if (value.kind === 'string' && i === 0 && ['function', '->', 'do'].includes(parent?.kind)) continue;
        if (value.kind === 'string' && ['function', 'macro', 'struct', 'module', 'baremodule', 'const', 'global', 'local', 'macrocall', '='].includes(node.children[i + 1]?.kind)) continue;
        if (candidate(statement) && discarded(statement, source)) context.report({ node: statement, messageId: isComparison(statement) ? 'comparison' : 'issue' });
      }
    }
    return { block: check, toplevel: check, JuliaFile: check };
  },
});
