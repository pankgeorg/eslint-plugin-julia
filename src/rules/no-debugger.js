import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
import { originResolver, visible, writtenName, strip } from './restricted-common.js';
import { span } from './idiom-common.js';
const debuggerMacros = {
  Infiltrator: ['@infiltrate', '@exfiltrate'],
  Debugger: ['@enter', '@run', '@bp'],
};
const origins = new Set(Object.entries(debuggerMacros).flatMap(([mod, names]) => names.map(name => `${mod}.${name}`)));
// Infiltrator's macro names are distinctive, and Infiltrator is usually loaded from the REPL or
// startup.jl rather than imported by the file: report them bare when nothing in scope defines or
// imports the name, and in the `Main.@infiltrate` form Infiltrator documents for such code.
const distinctive = new Set(debuggerMacros.Infiltrator);
const mainQualified = /^Main\.(?:Infiltrator\.)?(@infiltrate|@exfiltrate)$/u;
export default defineRule({
  meta: { type: 'problem', hasSuggestions: true,
    docs: { description: 'Report interactive breakpoint macros left in source code.' },
    defaultOptions: [{ checkImports: false, includeMacroPayloads: false }],
    schema: [{ type: 'object', additionalProperties: false, properties: {
      checkImports: { type: 'boolean' }, includeMacroPayloads: { type: 'boolean' },
    } }], messages: { breakpoint: 'Remove the interactive debugger invocation {{name}}.',
      debuggerImport: 'Remove the interactive debugger dependency {{name}} from this file.',
      remove: 'Remove this debugger statement.' } },
  create(context) {
    const source = context.sourceCode, m = getScopeManager(source, context), options = context.options[0] ?? {};
    const origin = originResolver(m, debuggerMacros);
    function unimported(node) {
      const head = node.children[0], spelling = writtenName(head);
      if (!spelling) return null;
      const scope = m.scopeFor(node) ?? m.globalScope;
      if (distinctive.has(spelling) && !(m.resolve(strip(head)) ?? m.lookup(spelling, scope))) return `Infiltrator.${spelling}`;
      const q = mainQualified.exec(spelling);
      const main = q && m.lookup('Main', scope);
      return q && (!main || main.kind === 'builtin') ? `Infiltrator.${q[1]}` : null;
    }
    function checkImport(node) {
      if (!options.checkImports || !visible(node, source, options.includeMacroPayloads)) return;
      const packages = new Set(node.children.map(c => c.kind === ':' || c.kind === 'as' ? c.children[0] : c)
        .map(path => source.getText(path).replace(/\s/gu, '').split('.')[0]).filter(name => Object.hasOwn(debuggerMacros, name)));
      for (const name of packages) context.report({ node, messageId: 'debuggerImport', data: { name } });
    }
    return {
      macrocall(node) {
        if (!visible(node, source, options.includeMacroPayloads)) return;
        const name = origin(node.children[0], node) ?? unimported(node);
        if (!origins.has(name)) return;
        let statement = node, parent = source.getParent(statement);
        while (parent?.kind === 'parens') { statement = parent; parent = source.getParent(parent); }
        const range = span(source, statement);
        const wholeStatement = ['block', 'toplevel'].includes(parent?.kind);
        const comments = source.comments.some(c => c.range[0] >= range[0] && c.range[1] <= range[1]);
        context.report({ node, messageId: 'breakpoint', data: { name },
          ...(wholeStatement && !comments && { suggest: [{ messageId: 'remove', fix: fixer => fixer.removeRange(range) }] }) });
      },
      using: checkImport, import: checkImport,
    };
  },
});
