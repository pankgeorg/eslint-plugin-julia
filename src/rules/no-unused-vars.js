import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
function macroOption(definition, source) {
  const assignment = definition.assignment;
  if (!assignment) return false;
  let bracket = false;
  for (let child = assignment, parent = source.getParent(child); parent;
    child = parent, parent = source.getParent(parent)) {
    if (['function', 'macro', '->', 'do'].includes(parent.kind)) return false;
    if (parent.kind === 'macrocall') return bracket || child === assignment && parent.children.indexOf(child) > 1;
    if (['vect', 'hcat', 'vcat', 'ncat'].includes(parent.kind)) bracket = true;
  }
  return false;
}
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Report local bindings that are never read.' },
    schema: [{ type: 'object', properties: { imports: { enum: ['all', 'none'] }, args: { enum: ['none', 'all'] }, ignoreKeywords: { type: 'boolean' },
      caughtErrors: { enum: ['all', 'none'] }, ignorePattern: { type: 'string' },
      dynamicReads: { enum: ['strict', 'ignore-containing-scope'] } }, additionalProperties: false }],
    messages: { unusedImport: 'Imported name "{{name}}" is never read in this module.', unused: 'Local "{{name}}" is never read.' } },
  create(context) { return { JuliaFile() {
    const m = getScopeManager(context.sourceCode, context), o = context.options[0] ?? {};
    let ignore; try { ignore = new RegExp(o.ignorePattern ?? '^_', 'u'); } catch { return; }
    const excluded = new Set(['import', 'function', 'macro', 'type', 'module', 'module-self', 'type-parameter', 'intrinsic', 'implicit-argument']);
    for (const s of m.scopes) for (const b of s.bindings.values()) {
      if (!b.name || ignore.test(b.name) || b.references.some(r => r.read)) continue;
      if (b.definitions.length && b.definitions.every(d => macroOption(d, context.sourceCode))) continue;
      if (s.kind === 'module') {
        if (b.kind !== 'import' || b.external || !b.definitions.length || o.imports === 'none'
          || b.definitions.some(d => ['function', 'macro'].includes(d.kind))) continue;
        const models = m.moduleResolution.scopes.get(s) ?? [];
        if (models.some(model => model.reads.has(b.name) || model.exports.has(b.name)
          || model.unresolvedIncludes || model.dynamicEvaluation)) continue;
        // A wildcard import is useful when its module or any of its exports is
        // used. Unknown wildcard exports cannot prove that an import is unused.
        if (b.definitions.some(d => !d.named && models.some(model => model.imports.some(imp =>
          imp.wildcard && imp.path === d.moduleName && (!imp.resolvedExports ||
            [...imp.resolvedExports].some(name => model.reads.has(name) || model.exports.has(name))))))) continue;
        context.report({ node: b.definitions[0].node, messageId: 'unusedImport', data: { name: b.name } });
        continue;
      }
      if (excluded.has(b.kind)) continue;
      if (b.definitions.some(d => ['argument', 'keyword'].includes(d.kind)) && o.args !== 'all') continue;
      if (o.ignoreKeywords && b.definitions.some(d => d.kind === 'keyword')) continue;
      if (o.caughtErrors === 'none' && b.kind === 'catch') continue;
      if (o.dynamicReads === 'ignore-containing-scope') {
        let dynamic = false;
        for (let at = s; at && at.kind !== 'module'; at = at.parent) dynamic ||= at.dynamic;
        if (dynamic) continue;
      }
      context.report({ node: b.definitions[0].node, messageId: 'unused', data: { name: b.name } });
    }
  } }; },
});
