import { defineRule } from './common.js';
export default defineRule({
  meta: {
    type: 'problem',
    schema: [],
    docs: { description: 'Report JuliaSyntax errors in recovery mode.' },
    messages: { parse: '{{message}}' },
  },
  create(context) {
    return {
      JuliaFile() {
        for (const d of context.sourceCode.diagnostics) {
          if (d.level === 1)
            context.report({ loc: d.loc, messageId: 'parse', data: { message: d.message } });
        }
      },
    };
  },
});
