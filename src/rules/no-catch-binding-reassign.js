import { check, ordinary } from './semantic-common.js';
export default check('Report writes replacing a caught exception binding.', (context, m, source) => ({ JuliaFile() {
  const caught = new Set(m.definitions.filter(d => d.kind === 'catch').map(d => d.binding));
  for (const d of m.definitions) {
    if (!d.initialized || d.kind === 'catch' || !caught.has(d.binding) || !ordinary(d.node, source)) continue;
    context.report({ node: d.node, messageId: 'diagnostic', data: { message: 'Reassigning this catch binding replaces its caught value; use a separate variable.' } });
  }
} }));
