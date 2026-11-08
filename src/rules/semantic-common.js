import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
export * from './idiom-common.js';

// Pass the physical filename through so include/package shadowing is respected.
export function check(description, create, { properties = {}, fixable, suggestions = false } = {}) {
  return defineRule({
    meta: { type: 'problem', docs: { description },
      schema: [{ type: 'object', properties, additionalProperties: false }],
      ...(fixable && { fixable }), ...(suggestions && { hasSuggestions: true }),
      messages: { diagnostic: '{{message}}', replace: '{{message}}' } },
    create(context) {
      return create(context, getScopeManager(context.sourceCode, context), context.sourceCode, context.options[0] ?? {});
    },
  });
}
