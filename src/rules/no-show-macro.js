import { defineRule } from './common.js';
import { isQuoted, isInsideMacro } from '../parser/flags.js';
import { getLocalScopeManager, getScopeManager, identifierName } from '../scope.js';

const names = ['@show', '@showtime'];
function builtin(binding, name) {
  return binding?.kind === 'builtin' && binding.name === name
    || binding && !binding.writes.length && binding.definitions.some(d => d.kind === 'import'
      && d.moduleName === 'Base' && d.imported.split(/\s+as\s+/u)[0].split('.').at(-1).trim() === name);
}
function statement(node, source) {
  let parent = source.getParent(node);
  while (parent?.kind === 'parens' && parent.children.length === 1) {
    node = parent; parent = source.getParent(node);
  }
  return ['block', 'toplevel', 'JuliaFile'].includes(parent?.kind);
}
export default defineRule({
  meta: {
    type: 'suggestion', docs: { description: 'Report unshadowed Base debugging output macros.' },
    schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true } }, additionalProperties: false }],
    defaultOptions: [{ allow: [] }], hasSuggestions: true,
    messages: { debug: 'Remove debugging output from {{name}}.', remove: 'Remove the debugging macro, keeping its expression evaluated.' },
  },
  create(context) {
    const source = context.sourceCode, allowed = new Set((context.options[0]?.allow ?? []).map(n => n.replace(/^@/u, '')));
    let manager, local;
    return { macrocall(node) {
      if (isQuoted(node, source) || isInsideMacro(source.getParent(node), source)) return;
      const head = node.children[0];
      local ??= getLocalScopeManager(source);
      const possible = names.some(name => head.kind === '.'
        ? local.isUnshadowedBuiltin(head, name)
        : builtin(local.lookup(identifierName(head), local.scopeFor(node)), name));
      if (!possible) return;
      manager ??= getScopeManager(source, context);
      const scope = manager.scopeFor(node);
      const name = names.find(name => head.kind === '.'
        ? manager.isUnshadowedBuiltin(head, name)
        : builtin(manager.lookup(identifierName(head), scope), name));
      if (!name || allowed.has(name.slice(1))) return;
      // Dropping the entire statement could drop calls or writes in its payload.
      // For a single expression, unwrap it instead, retaining effects and value.
      const arg = node.children[1];
      const suggest = node.children.length === 2 && statement(node, source) ? [{ messageId: 'remove',
        fix: fixer => fixer.replaceText(node, `(${source.getText(arg)})`),
      }] : [];
      context.report({ node: head, messageId: 'debug', data: { name }, suggest });
    } };
  },
});
