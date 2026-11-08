import { call, integer, strip, identifierName } from './idiom-common.js';
import { isInfixCall } from '../parser/flags.js';

export const positional = args => args && args.every(n => !['parameters', '...', '='].includes(n.kind));
export const within = (node, container) => node.range[0] >= container.range[0] && node.range[1] <= container.range[1];
export const localBinding = (node, m) => {
  const binding = m.resolve(strip(node));
  return binding?.scope && binding.scope.kind !== 'module' ? binding : null;
};
// Bound literal arithmetic to machine-sized signed integers. Never enumerate a range.
export function rangeCount(node, m) {
  node = strip(node);
  if (!isInfixCall(node) || ![3, 4].includes(node.children.length) || !m.isUnshadowedBuiltin(node.children[1], ':')) return null;
  const values = [node.children[0], ...node.children.slice(2)].map(integer);
  const limit = (1n << 63n) - 1n;
  if (values.some(n => n === null || n < -limit || n > limit)) return null;
  const [start, step, stop] = values.length === 2 ? [values[0], 1n, values[1]] : values;
  if (step === 0n) return null;
  const distance = step > 0n ? stop - start : start - stop;
  const count = distance < 0n ? 0n : distance / (step > 0n ? step : -step) + 1n;
  return count <= limit ? count : null;
}
const scalarTypes = ['Int', 'Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'Float16', 'Float32', 'Float64', 'Bool', 'Char', 'String', 'Any'];
export const builtinType = (node, m) => scalarTypes.some(name => m.isUnshadowedBuiltin(node, name));
export function arrayLiteral(node, m, empty = false) {
  node = strip(node);
  if (node.kind === 'vect') return !empty || node.children.length === 0;
  if (node.kind === 'ref' && builtinType(node.children[0], m)) return !empty || node.children.length === 1;
  if (!empty && ['vcat', 'hcat', 'ncat'].includes(node.kind)) return true;
  if (!empty && ['typed_vcat', 'typed_hcat', 'typed_ncat'].includes(node.kind)) return builtinType(node.children[0], m);
  const args = call(node, 'Vector', m);
  if (args?.length === 0 && node.children[0].kind === 'curly' && node.children[0].children.length === 2) return true;
  return false;
}
export function emptyArray(node, m) {
  if (arrayLiteral(node, m, true)) return true;
  const args = call(node, 'zeros', m);
  return positional(args) && args.length > 0 && args.every(n => integer(n) !== null && integer(n) >= 0n) && args.some(n => integer(n) === 0n);
}
// The assignment must precede the use in a containing straight-line block.
export function precedes(assignment, use, source) {
  for (let at = use, parent; (parent = source.getParent(at)); at = parent) {
    if (parent.kind === 'let' && within(assignment, parent.children[0]) && at === parent.children[1]) return true;
    if (['block', 'toplevel'].includes(parent.kind)) {
      const i = parent.children.indexOf(assignment), j = parent.children.indexOf(at);
      if (i >= 0 && i < j) return true;
    }
  }
  return false;
}
export function initializedLocal(node, m, source) {
  const binding = localBinding(node, m);
  if (binding?.definitions.length !== 1) return null;
  const assignment = binding.definitions[0].assignment;
  return assignment?.kind === '=' && identifierName(assignment.children[0]) !== null && precedes(assignment, node, source)
    ? assignment.children[1] : null;
}

export function assignmentTarget(node, source) {
  let parent = source.getParent(node);
  while (parent && (['tuple', 'parens'].includes(parent.kind) || parent.kind === '::' && parent.children[0] === node)) {
    node = parent; parent = source.getParent(node);
  }
  return ['=', 'op=', '.=', 'in'].includes(parent?.kind) && parent.children[0] === node;
}
