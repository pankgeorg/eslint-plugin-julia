import { rule, ordinary, identifierName, strip, suggest } from './idiom-common.js';
export default rule('Report later identical supported positional method signatures.', { allowRedefinition: { type: 'boolean' } },
(context, m, source, options) => ({ JuliaFile() {
  if (options.allowRedefinition) return;
  const seen = new Map(), identities = new Map(); let serial = 0;
  const id = b => { if (!identities.has(b)) identities.set(b, ++serial); return identities.get(b); };
  for (const fn of m.functions) {
    if (fn.node.kind !== 'function' || !fn.call || fn.typeParameters.length || !ordinary(fn.node, source)) continue;
    const head = strip(fn.call.children[0]), binding = m.resolve(head);
    if (identifierName(head) === null || !binding || binding.scope.kind !== 'module' || binding.definitions.some(d => d.kind === 'type')) continue;
    let unconditional = true;
    for (let at = source.getParent(fn.node); at && at !== binding.scope.node; at = source.getParent(at)) if (!['block','toplevel','JuliaFile'].includes(at.kind)) unconditional = false;
    if (!unconditional) continue;
    const types = []; let supported = true;
    for (const arg of fn.call.children.slice(1).filter(n => n.kind !== 'parameters')) {
      if (identifierName(arg) !== null) { types.push('Any'); continue; }
      if (arg.kind !== '::') { supported = false; break; }
      const type = strip(arg.children.at(-1)), typeBinding = m.resolve(type);
      let builtinName = typeBinding?.kind === 'builtin' ? typeBinding.name : null;
      if (type.kind === '.' && m.isUnshadowedBuiltin(type, identifierName(type.children[1]))) builtinName = identifierName(type.children[1]);
      if (!builtinName && typeBinding) for (const d of typeBinding.definitions) if (d.kind === 'import' && ['Base','Core'].includes(d.moduleName)) {
        const original = d.imported.split(/\s+as\s+/u)[0].split('.').at(-1).trim();
        if (m.isUnshadowedBuiltin(type, original)) builtinName = original;
      }
      if (builtinName) types.push(builtinName === 'Any' ? 'Any' : `builtin:${builtinName}`);
      else if (identifierName(type) !== null && typeBinding?.definitions.some(d => d.kind === 'type')) types.push(`type:${id(typeBinding)}`);
      else { supported = false; break; }
    }
    if (!supported) continue;
    const key = `${id(binding)}:${types.join(',')}`;
    if (seen.has(key)) suggest(context, fn.call, 'This positional method signature repeats an earlier method in the same module; keywords do not distinguish dispatch.');
    seen.set(key, fn);
  }
} }), false);
