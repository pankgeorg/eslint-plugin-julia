import { resolve } from 'node:path';
import { defineRule } from './common.js';
import { orphan } from '../orphans.js';

const virtual = (path) => !path || /^<.*>$/u.test(path);
const globs = { type: 'array', items: { type: 'string' }, uniqueItems: true };

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Report package files that no entry point includes.' },
    schema: [
      {
        type: 'object',
        properties: { entryPoints: globs, scripts: globs },
        additionalProperties: false,
      },
    ],
    messages: {
      orphan:
        'This file is not included from any entry point ({{entries}}); it never runs. Delete it, include it, or add it to entryPoints.',
    },
  },
  create(context) {
    return {
      JuliaFile() {
        const file = context.physicalFilename;
        if (virtual(file)) return;
        const result = orphan(resolve(file), context.options[0] ?? {}, context.sourceCode.text);
        if (!result) return;
        context.report({
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
          messageId: 'orphan',
          data: { entries: result.entries.join(', ') },
        });
      },
    };
  },
});
