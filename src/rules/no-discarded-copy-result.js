import { rule, ordinary, call, strip, suggest } from './idiom-common.js';
export default rule('Warn about discarded results of copying collection operations.', {
  knownArraysOnly: { type: 'boolean' }, checkCallbacks: { type: 'boolean' },
}, (context, m, source, options) => ({ call(node) {
  if (!ordinary(node, source)) return;
  const name = ['sort', 'reverse', 'unique', 'copy', ...(options.checkCallbacks === false ? [] : ['filter'])].find(n => call(node, n, m));
  if (!name) return;
  const args = call(node, name, m);
  if (args.some(n => n.kind === '...') || args.filter(n => n.kind !== 'parameters').length !== (name === 'filter' ? 2 : 1)) return;
  const keywords = args.filter(n => n.kind === 'parameters').flatMap(n => n.children);
  if (keywords.some(n => n.kind !== '=' || ['by', 'lt', 'order'].includes(n.children[0]?.value))) return;
  const block = source.getParent(node), fn = source.getParent(block);
  if (block?.kind !== 'block' || !['function', '->', 'do'].includes(fn?.kind) || fn.children.at(-1) !== block || block.children.at(-1) === node) return;
  const input = strip(args[name === 'filter' ? 1 : 0]);
  if (options.knownArraysOnly && !['vect', 'vcat', 'hcat', 'typed_vcat'].includes(input.kind)) return;
  suggest(context, node, `The result of ${name} is discarded; review whether mutation or the returned copy was intended.`);
} }), false);
