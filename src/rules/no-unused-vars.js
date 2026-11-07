import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Report local bindings that are never read.' },
    schema: [{ type: 'object', properties: { args: { enum: ['none', 'all'] }, ignoreKeywords: { type: 'boolean' },
      caughtErrors: { enum: ['all', 'none'] }, ignorePattern: { type: 'string' },
      dynamicReads: { enum: ['strict', 'ignore-containing-scope'] } }, additionalProperties: false }],
    messages: { unused: 'Local "{{name}}" is never read.' } },
  create(context) { return { JuliaFile() {
    const m = getScopeManager(context.sourceCode), o = context.options[0] ?? {};
    let ignore; try { ignore = new RegExp(o.ignorePattern ?? '^_', 'u'); } catch { return; }
    const excluded = new Set(['import', 'function', 'macro', 'type', 'module', 'module-self', 'type-parameter', 'intrinsic', 'implicit-argument']);
    for (const s of m.scopes) for (const b of s.bindings.values()) {
      if (s.kind === 'module' || excluded.has(b.kind) || ignore.test(b.name) || b.references.some(r => r.read)) continue;
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
