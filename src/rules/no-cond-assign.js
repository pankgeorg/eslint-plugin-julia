import { defineRule, isOpaque } from './common.js';
import { isInfixCall } from '../parser/flags.js';
const comparisons = new Set(['==', '!=', '===', '!==', '<', '<=', '>', '>=', '≤', '≥', '≠', '≡', '≢', 'isa', 'in', '∈', '∉']);
const boundaries = new Set(['function', 'macro', '->', 'do', 'macrocall', 'quote', 'inert']);
export default defineRule({
  meta: { type: 'problem', hasSuggestions: true, schema: [{ type: 'object', properties: { allowParenthesized: { type: 'boolean' } }, additionalProperties: false }], docs: { description: 'Report assignments evaluated in conditions.' }, messages: { issue: 'Assignment is evaluated in a Boolean condition.', compare: 'Compare with == instead of assigning.' } },
  create(context) {
    const source = context.sourceCode, reported = new WeakSet();
    function tested(node) {
      for (let child = node, p = source.getParent(child); p; child = p, p = source.getParent(p)) {
        if (p.kind === 'parens') continue;
        if (['&&', '||'].includes(p.kind)) { if (p.children[0] === child) return true; continue; }
        return ['if', 'elseif', 'while', '?'].includes(p.kind) && p.children[0] === child;
      }
      return false;
    }
    function check(node) {
      if (!node.interior || isOpaque(node, source)) return;
      const logical = ['&&', '||'].includes(node.kind);
      if (logical) {
        for (let p = source.getParent(node); p; p = source.getParent(p)) {
          if (boundaries.has(p.kind) || ['block', 'toplevel'].includes(p.kind)) break;
          if (p.kind === 'comparison' || isInfixCall(p) && comparisons.has(p.children[1]?.value)) return;
        }
      }
      // A final short-circuit operand can be a value/assignment, not a Bool.
      const roots = logical ? (tested(node) ? node.children : [node.children[0]]) : [node.children[0]];
      for (const root of roots) {
        const stack = [[root, false]];
        while (stack.length) {
          const [n, grouped] = stack.pop();
          if (!n || boundaries.has(n.kind) || n.kind === 'finally') continue;
          // Sequential setup and let bindings are not tested values.
          if (['block', 'toplevel', 'let', 'catch', 'else'].includes(n.kind)) {
            if (n.children.length) stack.push([n.children.at(-1), false]);
            continue;
          }
          if (['for', 'while'].includes(n.kind)) continue;
          if (n.kind === 'comparison' || isInfixCall(n) && comparisons.has(n.children[1]?.value)) continue;
          const parent = source.getParent(n);
          if (n.kind === 'parameters') continue;
          // In call argument positions an unparenthesized = is keyword syntax.
          if (n.kind === '=' && ['call', 'dotcall'].includes(parent?.kind)) continue;
          const assignment = n.interior && ['=', 'op=', '.=', '.op='].includes(n.kind);
          if (assignment && !(grouped && context.options[0]?.allowParenthesized) && !reported.has(n)) {
            reported.add(n);
            const operator = n.kind === '=' && tested(n) && source.tokens.find(t => t.value === '=' && t.range[0] >= n.children[0].range[1] && t.range[1] <= n.children[1].range[0]);
            context.report({ node: n, messageId: 'issue', ...(operator && { suggest: [{ messageId: 'compare', fix: fixer => fixer.replaceText(operator, '==') }] }) });
          }
          for (const child of n.children) stack.push([child, n.kind === 'parens']);
        }
      }
    }
    return { if: check, elseif: check, while: check, '[kind="?"]': check, '[kind="&&"]': check, '[kind="||"]': check };
  },
});
