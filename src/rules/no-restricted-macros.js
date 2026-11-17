import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
import {
  writtenName,
  originResolver,
  matches,
  visible,
  optionsSchema,
  text,
} from './restricted-common.js';
export default defineRule({
  meta: {
    type: 'suggestion',
    docs: { description: 'Restrict configured written macro invocations by origin or spelling.' },
    defaultOptions: [{ entries: [], includeMacroPayloads: false }],
    schema: optionsSchema({
      when: {
        type: 'object',
        additionalProperties: false,
        required: ['argumentIndex', 'argumentText'],
        properties: {
          argumentIndex: { type: 'integer', minimum: 0 },
          argumentText: { type: 'string' },
        },
      },
    }),
    messages: { restricted: '{{name}} is restricted. {{message}}' },
  },
  create(context) {
    const options = context.options[0] ?? {},
      entries = options.entries ?? [];
    if (!entries.length) return {};
    const source = context.sourceCode,
      m = getScopeManager(source, context),
      origin = originResolver(m);
    return {
      macrocall(node) {
        if (!visible(node, source, options.includeMacroPayloads)) return;
        const [head, ...args] = node.children,
          spelling = writtenName(head),
          resolved = origin(head, node);
        if (!spelling) return;
        for (const entry of entries) {
          if (!matches(entry, spelling, resolved)) continue;
          if (entry.when) {
            const arg = args[entry.when.argumentIndex];
            if (!arg || text(source, arg) !== entry.when.argumentText) continue;
          }
          context.report({
            node,
            messageId: 'restricted',
            data: {
              name: spelling,
              message: entry.message ?? 'Use an approved project alternative.',
            },
          });
        }
      },
    };
  },
});
