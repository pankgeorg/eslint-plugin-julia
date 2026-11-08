import { defineRule } from './common.js';
import { getScopeManager } from '../scope.js';
import { invocation, writtenName, originResolver, matches, visible, withinFunction, constInitializer, optionsSchema, strip } from './restricted-common.js';
export default defineRule({
  meta: { type: 'suggestion', docs: { description: 'Restrict configured function invocations by origin or spelling.' },
    defaultOptions: [{ entries: [], includeMacroPayloads: false }],
    schema: optionsSchema({
      minArgs: { type: 'integer', minimum: 0 }, maxArgs: { type: 'integer', minimum: 0 },
      context: { enum: ['any', 'const-initializer'] },
      exceptWithinFunctions: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    }), messages: { restricted: '{{name}} is restricted. {{message}}' } },
  create(context) {
    const options = context.options[0] ?? {}, entries = options.entries ?? [];
    if (!entries.length) return {};
    const source = context.sourceCode, m = getScopeManager(source, context), origin = originResolver(m);
    const signatures = new Set(m.functions.map(fn => fn.call));
    function check(node) {
      if (!visible(node, source, options.includeMacroPayloads) || signatures.has(node)) return;
      const { head, args } = invocation(node), spelling = writtenName(head);
      if (!spelling) return;
      const resolved = origin(head, node);
      // '=' before the semicolon is also a keyword argument in invocation syntax.
      const positional = args.filter(n => !['parameters', '='].includes(n.kind));
      const unknownArity = positional.some(n => strip(n).kind === '...');
      for (const entry of entries) {
        if (!matches(entry, spelling, resolved) || withinFunction(node, entry.exceptWithinFunctions, m)) continue;
        if (entry.context === 'const-initializer' && !constInitializer(node, source)) continue;
        if ((entry.minArgs !== undefined || entry.maxArgs !== undefined) && (unknownArity
          || positional.length < (entry.minArgs ?? 0) || positional.length > (entry.maxArgs ?? Infinity))) continue;
        context.report({ node, messageId: 'restricted', data: { name: spelling, message: entry.message ?? 'Use an approved project alternative.' } });
      }
    }
    return { call: check, dotcall: check };
  },
});
