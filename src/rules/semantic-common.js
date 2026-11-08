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

// Deliberately small catalogue: membership proves a named builtin type, not
// arbitrary type-valued exports or equivalence between aliases such as Int/Int64.
export const builtinTypes = new Set(['Any', 'Union', 'UnionAll', 'DataType', 'Type', 'Nothing', 'Missing',
  'Bool', 'Char', 'Symbol', 'String', 'AbstractString', 'Number', 'Real', 'Integer', 'Signed', 'Unsigned',
  'AbstractFloat', 'Float16', 'Float32', 'Float64', 'Int', 'Int8', 'Int16', 'Int32', 'Int64', 'Int128',
  'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'BigInt', 'BigFloat', 'Function', 'IO',
  'Tuple', 'NamedTuple', 'AbstractArray', 'Array', 'Vector', 'Matrix', 'AbstractVector', 'AbstractMatrix',
  'Dict', 'Set', 'Pair', 'Exception', 'Module', 'Task']);
export function stableType(node, m) {
  while (node?.kind === 'parens' && node.children.length === 1) node = node.children[0];
  for (const name of builtinTypes) if (m.isUnshadowedBuiltin(node, name)) return `builtin:${name}`;
  const b = m.resolve(node);
  return b?.kind === 'type-parameter' && !b.writes.length ? b : null;
}
