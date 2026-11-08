import { rule, identifierName } from './idiom-common.js';
import { isQuoted } from '../parser/flags.js';
export default rule('Disallow Base @time in files selected as library source.', {}, (context, m, source) => ({ macrocall(node) {
  if (isQuoted(node, source)) return;
  for (let parent = source.getParent(node); parent; parent = source.getParent(parent)) if (['macrocall', 'macro'].includes(parent.kind)) return;
  const head = node.children[0];
  let builtin = m.isUnshadowedBuiltin(head, '@time');
  if (head.kind === 'macro_name') {
    // Macro heads are not value references in the scope pass; lookup occurs in
    // the expansion module, independently of runtime locals named time/Base.
    const binding = m.lookup(identifierName(head), m.scopeFor(node)?.module);
    builtin = binding?.kind === 'builtin' && binding.name === '@time'
      || binding?.writes.length === 0 && binding.definitions.some(d => d.kind === 'import' && d.moduleName === 'Base' && d.imported.split(/\s+as\s+/u)[0].split('.').at(-1).trim() === '@time');
  }
  if (builtin) context.report({ node, messageId: 'diagnostic', data: { message: 'Base @time prints timing/allocation instrumentation in selected library source; review whether it belongs in a benchmark or explicit diagnostics API.' } });
} }), false);
