import { isInsideMacro, isQuoted } from '../parser/flags.js';

// Every shipped rule passes through this guard. A future rule cannot accidentally
// expose edits on a recovered file by forgetting a per-rule diagnostic check.
export function defineRule(rule) {
  return { ...rule, create(context) {
    if (!context.sourceCode.diagnostics.some(d => d.level === 1)) return rule.create(context);
    const guarded = Object.create(context, { report: { value(descriptor) {
      const { fix, suggest, ...diagnostic } = descriptor;
      context.report(diagnostic);
    } } });
    return rule.create(guarded);
  } };
}
export const isBareName = n => n?.kind === 'Identifier' && !n.interior && n.originalKind === 'Identifier';
export const isOpaque = (n, source) => isInsideMacro(n, source) || isQuoted(n, source);
export function isSignature(node, source) {
  for (let child = node, parent = source.getParent(child); parent;
    child = parent, parent = source.getParent(parent)) {
    if (['function', 'macro', '->'].includes(parent.kind) && parent.children[0] === child) return true;
  }
  return false;
}
