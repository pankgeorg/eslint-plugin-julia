import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { check, ordinary, strip, identifierName, builtinTypes } from './semantic-common.js';

// Ownership is deliberately limited to named projects and explicit Base/Core
// generic extensions. External/imported bindings alone do not prove ownership.
function projectName(filename) {
  if (!filename || /^<.*>$/u.test(filename)) return null;
  for (let dir = dirname(filename);;) {
    try {
      const text = readFileSync(join(dir, 'Project.toml'), 'utf8').split(/^\s*\[/mu)[0];
      const name = text.match(/^\s*name\s*=\s*"([^"]+)"/mu)?.[1];
      if (name) return name;
    } catch { /* No readable named project here: keep looking upwards. */ }
    const parent = dirname(dir); if (parent === dir) return null; dir = parent;
  }
}
const generics = new Set(['length', 'isempty', 'copy', 'deepcopy', 'show', 'summary', 'print', 'println',
  'getindex', 'setindex!', 'iterate', 'eltype', 'size', 'axes', 'first', 'last', 'hash', 'isequal',
  'isless', 'convert', 'promote_rule', 'zero', 'one', 'keys', 'values', 'pairs', 'push!', 'append!',
  'empty!', 'get', 'get!', 'haskey', 'delete!', 'in', 'string', 'repr', 'read', 'write', 'close', 'flush']);
export default check('Report simple all-builtin Base/Core method extensions in named projects.', (context, m, source) => {
  const owner = projectName(context.physicalFilename);
  if (!owner || ['Base', 'Core'].includes(owner)) return {};
  return { JuliaFile() {
    for (const fn of m.functions) {
      if (fn.node.kind !== 'function' || !fn.call || fn.typeParameters.length || !ordinary(fn.node, source)) continue;
      let internal = false;
      for (let s = fn.scope.parent; s; s = s.parent)
        if (s.kind === 'module' && ['Base', 'Core'].includes(identifierName(s.node.children[0]))) internal = true;
      if (internal) continue;
      const head = strip(fn.call.children[0]);
      if (head?.kind !== '.') continue;
      const name = identifierName(head.children[1]);
      if (!generics.has(name) || !m.isUnshadowedBuiltin(head, name)) continue;
      const args = fn.call.children.slice(1);
      if (!args.length) continue;
      const foreign = args.every(arg => {
        if (identifierName(arg) !== null) return true; // unannotated Any
        if (arg.kind !== '::' || ![1, 2].includes(arg.children.length)) return false;
        const type = strip(arg.children.at(-1));
        return [...builtinTypes].some(t => m.isUnshadowedBuiltin(type, t));
      });
      if (!foreign) continue;
      context.report({ node: fn.call, messageId: 'diagnostic', data: { message: 'This Base/Core generic extension uses only builtin argument types; review possible type piracy.' } });
    }
  } };
});
