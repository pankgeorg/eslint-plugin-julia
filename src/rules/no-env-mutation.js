import { defineRule } from './common.js';
import { getScopeManager, identifierName } from '../scope.js';
import { ordinary, strip } from './idiom-common.js';
import { isInfixCall } from '../parser/flags.js';

const mutators = ['delete!', 'pop!', 'get!', 'push!', 'empty!', 'merge!', 'setindex!'];
export default defineRule({
  meta: {
    type: 'suggestion', docs: { description: 'Review direct writes to the process environment.' },
    schema: [{ type: 'object', additionalProperties: false, properties: { allowInInit: { type: 'boolean' } } }],
    defaultOptions: [{ allowInInit: false }],
    messages: { mutation: 'This writes to the process environment; prefer scoped withenv where possible.' },
  },
  create(context) {
    const source = context.sourceCode, m = getScopeManager(source, context);
    const functions = new Map(m.functions.map(fn => [fn.scope, fn]));
    function exempt(node) {
      if (!context.options[0]?.allowInInit) return false;
      for (let s = m.scopeFor(node); s && s.kind !== 'module'; s = s.parent) {
        if (s.kind !== 'function') continue;
        const fn = functions.get(s);
        return s.parent.kind === 'module' && fn?.call?.children.length === 1
          && identifierName(fn.call.children[0]) === '__init__';
      }
      return false;
    }
    const env = n => m.isUnshadowedBuiltin(strip(n), 'ENV');
    function report(node) {
      if (ordinary(node, source) && !exempt(node)) context.report({ node, messageId: 'mutation' });
    }
    function assignment(node) {
      const target = strip(node.children[0]);
      if (target?.kind === 'ref' && env(target.children[0])) report(node);
    }
    return {
      '*': node => { if (['=', 'op=', '.='].includes(node.kind)) assignment(node); },
      call(node) {
        if (!ordinary(node, source) || isInfixCall(node)) return;
        const name = mutators.find(name => m.isUnshadowedBuiltin(strip(node.children[0]), name));
        if (!name) return;
        const args = node.children.slice(1);
        // get!(default_function, dictionary, key) is also used by do syntax.
        if (env(args[0]) || name === 'get!' && args.length >= 3 && env(args[1])) report(node);
      },
    };
  },
});
