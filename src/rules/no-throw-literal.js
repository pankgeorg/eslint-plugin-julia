import { checkRule, call, ordinary, strip, report, text, baseAvailable } from './correctness-common.js';
export default checkRule('Discourage throwing literal values instead of exceptions.', (context, m, source) => ({ call(node) {
  const args = call(node, 'throw', m);
  if (!args || args.length !== 1 || !ordinary(node, source)) return;
  const value = strip(args[0]);
  const string = value.kind === 'string' && value.children.every(n => n.kind === 'String');
  if (!string && !['Integer', 'Float', 'Float32', 'Bool', 'char'].includes(value.kind)
    && !['nothing', 'missing'].some(name => m.isUnshadowedBuiltin(value, name))) return;
  report(context, node, 'Throw an exception object; literal throws provide little diagnostic context.',
    string && baseAvailable(m, node) ? `Base.error(${text(source, args[0])})` : null);
} }), true);
