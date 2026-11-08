import { defineRule, isOpaque } from './common.js';
import { isQuoted } from '../parser/flags.js';
import { identifierName } from '../scope.js';

// importpath separates names but retains each leading relative dot as a leaf.
function path(node) {
  if (node.kind === 'as') return path(node.children[0]);
  if (node.kind !== 'importpath') return identifierName(node) ?? node.value ?? '';
  let result = '';
  for (const part of node.children) {
    if (part.kind === '.' && !part.interior) result += '.';
    else result += (result && !result.endsWith('.') ? '.' : '') + path(part);
  }
  return result;
}
function glob(pattern) {
  return new RegExp(`^${[...pattern].map(c => c === '*' ? '[^.]*' : c === '?' ? '[^.]' : c.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&')).join('')}$`, 'u');
}
const strings = { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } };
export default defineRule({
  meta: {
    type: 'suggestion', docs: { description: 'Restrict written module imports and require explicit using lists.' },
    schema: [{ type: 'object', additionalProperties: false, properties: {
      entries: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['message'], oneOf: [{ required: ['module'] }, { required: ['modulePattern'] }], properties: {
          module: { type: 'string', minLength: 1 }, modulePattern: { type: 'string', minLength: 1 },
          names: { ...strings, minItems: 1 }, kind: { enum: ['using', 'import', 'both'] }, message: { type: 'string', minLength: 1 },
        } } },
      banImport: { type: 'boolean' }, requireExplicitNames: { type: 'boolean' },
      allowBareUsing: strings, includeMacroPayloads: { type: 'boolean' },
    } }],
    defaultOptions: [{ entries: [], banImport: false, requireExplicitNames: false, allowBareUsing: [], includeMacroPayloads: false }],
    messages: { restricted: '{{message}}', import: 'Import statements are restricted by project policy.',
      explicit: 'Use an explicit name list when using "{{module}}".' },
  },
  create(context) {
    const source = context.sourceCode, options = context.options[0] ?? {};
    const entries = (options.entries ?? []).map(e => ({ ...e, pattern: e.modulePattern && glob(e.modulePattern) }));
    const allowed = new Set(options.allowBareUsing);
    function check(node) {
      if (options.includeMacroPayloads ? isQuoted(node, source) : isOpaque(node, source)) return;
      if (node.kind === 'import' && options.banImport) context.report({ node, messageId: 'import' });
      const clauses = node.children.map(c => ({ node: c, module: path(c.kind === ':' ? c.children[0] : c),
        names: c.kind === ':' ? c.children.slice(1).map(path) : null }));
      if (node.kind === 'using' && options.requireExplicitNames) for (const c of clauses)
        if (!c.names && !allowed.has(c.module)) context.report({ node: c.node, messageId: 'explicit', data: { module: c.module } });
      for (const entry of entries) {
        if (entry.kind && entry.kind !== 'both' && entry.kind !== node.kind) continue;
        if (clauses.some(c => (entry.pattern ? entry.pattern.test(c.module) : c.module === entry.module)
          && (!entry.names || c.names?.some(n => entry.names.includes(n)))))
          context.report({ node, messageId: 'restricted', data: { message: entry.message } });
      }
    }
    return { using: check, import: check };
  },
});
