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

// Coordinate-free syntax identity. Visitable children already omit trivia.
// Strip redundant grouping only; retain kinds, exact leaf text, and parser
// semantic flags, following the pinned normal-form oracle's flag mask.
export function normalizedTreeKey(node) {
  const parts = [], stack = [node];
  while (stack.length) {
    let n = stack.pop();
    while (n.kind === 'parens' && n.interior && n.children.length === 1) n = n.children[0];
    let flags = (n.flags ?? 0) & ~(1 | 128);
    if (n.kind === 'toplevel') flags &= ~256;
    parts.push([n.kind, Boolean(n.interior), flags, n.value ?? null, n.children.length]);
    stack.push(...n.children.toReversed());
  }
  return JSON.stringify(parts);
}
