import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: { type: 'problem', schema: [], docs: { description: 'Disallow repeated names in one signature.' },
    messages: { duplicate: 'Duplicate argument "{{name}}".' } },
  create(context) { return { JuliaFile() {
    for (const fn of getScopeManager(context.sourceCode).functions) {
      const seen = new Set();
      for (const d of fn.arguments) {
        if (/^_+$/u.test(d.name)) continue;
        if (seen.has(d.name)) context.report({ node: d.node, messageId: 'duplicate', data: { name: d.name } });
        seen.add(d.name);
      }
    }
  } }; },
});
