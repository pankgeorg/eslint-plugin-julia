// Shared written-invocation matching. No macro expansion or value-alias inference.
import { readFileSync } from 'node:fs';
import { identifierName } from '../scope.js';
import { isInfixCall, isQuoted } from '../parser/flags.js';
import { strip, text } from './idiom-common.js';
export { strip, text };
const inventory = JSON.parse(
  readFileSync(new URL('../../data/base-core-exports.json', import.meta.url)),
);
const core = new Set([...inventory.Core, 'ccall']);
const base = new Set([...inventory.Base, 'include', 'eval']);
const builtin = (name) =>
  core.has(name) ? `Core.${name}` : base.has(name) ? `Base.${name}` : null;

export function glob(pattern, value) {
  const escaped = [...pattern]
    .map((c) =>
      c === '*' ? '[^.]*' : c === '?' ? '[^.]' : c.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&'),
    )
    .join('');
  return new RegExp(`^${escaped}$`, 'u').test(value);
}
export function canonical(path) {
  if (path === 'Threads' || path.startsWith('Threads.')) path = `Base.${path}`;
  // Base reexports Core bindings; both spellings identify the Core binding.
  if (/^Base\.[^.]+$/u.test(path) && core.has(path.slice(5))) return `Core.${path.slice(5)}`;
  return path;
}
function headName(node) {
  node = strip(node);
  if (['curly', 'TOMBSTONE'].includes(node?.kind)) return headName(node.children[0]);
  // Property syntax can quote an operator, e.g. Base.:+.
  if (node?.kind === 'quote' && node.children.length === 1) return identifierName(node.children[0]);
  return identifierName(node);
}
export function writtenName(node) {
  node = strip(node);
  if (['curly', 'TOMBSTONE'].includes(node?.kind)) return writtenName(node.children[0]);
  if (node?.kind === '.' && node.children.length === 2) {
    const left = writtenName(node.children[0]),
      right = headName(node.children[1]);
    return left && right ? `${left}.${right}` : null;
  }
  return headName(node);
}
export function invocation(node) {
  const i = isInfixCall(node) ? 1 : 0;
  return { head: node.children[i], args: node.children.filter((_, j) => i !== j) };
}
export function visible(node, source, includeMacroPayloads = false) {
  return (
    !isQuoted(node, source) &&
    (includeMacroPayloads || !source.getAncestors(node).some((n) => n.kind === 'macrocall'))
  );
}

// Explicit imports establish provenance even when a package is unavailable. Wildcard
// imports need an export fact. Known modules supply a small documented fallback for
// debugger macros; arbitrary unknown wildcard imports never establish an origin.
export function originResolver(m, knownModules = {}) {
  const modelsFor = (scope) => m.moduleResolution?.scopes.get(scope?.module) ?? [];
  function importedPath(d) {
    const original = d.imported.split(/\s+as\s+/u)[0].replace(/\s/gu, '');
    return canonical(d.named ? `${d.moduleName}.${original}` : d.moduleName);
  }
  function fromModels(name, scope) {
    const origins = new Set();
    for (const model of modelsFor(scope))
      for (const imp of model.imports) {
        const declarations = m.imports.filter(
          (d) => d.scope === scope.module && !d.named && d.moduleName === imp.path,
        );
        if (
          imp.wildcard &&
          declarations.length &&
          declarations.every((d) => d.importKind === 'import')
        )
          continue;
        if (
          imp.wildcard &&
          (imp.resolvedExports?.has(name) ||
            (Object.hasOwn(knownModules, imp.path) && knownModules[imp.path].includes(name)))
        )
          origins.add(canonical(`${imp.path}.${name}`));
        else if (!imp.wildcard)
          for (let i = 0; i < imp.names.length; i++)
            if (imp.names[i] === name) origins.add(canonical(`${imp.path}.${imp.sourceNames[i]}`));
      }
    return origins.size === 1 ? [...origins][0] : null;
  }
  function bindingOrigin(binding, name, scope) {
    if (!binding) return fromModels(name, scope);
    if (binding.kind === 'builtin') {
      // An unavailable wildcard package may export a competing name.
      if (scope?.module.bareUsing.some((p) => !['Base', 'Core'].includes(p))) return null;
      return builtin(name);
    }
    if (
      binding.kind !== 'import' ||
      binding.writes.length ||
      binding.definitions.some((d) => d.kind !== 'import')
    )
      return null;
    const origins = new Set(
      binding.definitions.filter((d) => d.kind === 'import').map(importedPath),
    );
    return origins.size === 1 ? [...origins][0] : origins.size ? null : fromModels(name, scope);
  }
  return (head, node) => {
    const spelling = writtenName(head);
    if (!spelling) return null;
    const scope = m.scopeFor(node) ?? m.globalScope;
    if (!spelling.includes('.')) {
      let bare = strip(head);
      while (['curly', 'TOMBSTONE'].includes(bare?.kind)) bare = strip(bare.children[0]);
      return bindingOrigin(m.resolve(bare) ?? m.lookup(spelling, scope), spelling, scope);
    }
    const [root, ...parts] = spelling.split('.');
    const b = m.lookup(root, scope);
    let namespace;
    if (b?.kind === 'builtin') {
      if (['Base', 'Core', 'Threads'].includes(root)) namespace = canonical(root);
    } else {
      const candidate = bindingOrigin(b, root, scope);
      const knownNamespace = [
        'Base',
        'Core',
        'Base.Threads',
        ...Object.keys(knownModules),
      ].includes(candidate);
      // A named import can be a function or an object, not a module. Only
      // recognized namespaces and explicit module imports establish a receiver.
      if (knownNamespace || b?.definitions.some((d) => d.kind === 'import' && !d.named))
        namespace = candidate;
    }
    // Qualified debugger names are accepted without loading those packages. A
    // written local definition of that root still takes precedence.
    if (!b && Object.hasOwn(knownModules, root)) namespace = root;
    return namespace ? canonical(`${namespace}.${parts.join('.')}`) : null;
  };
}
export function matches(entry, spelling, origin) {
  const resolved = (entry.binding ?? 'resolved') === 'resolved';
  const value = resolved ? origin : spelling;
  if (!value) return false;
  let wanted = entry.name ?? entry.pattern;
  if (resolved)
    wanted = wanted.includes('.')
      ? canonical(wanted)
      : entry.name
        ? (builtin(wanted) ?? wanted)
        : wanted;
  const candidate = wanted.includes('.') ? value : value.split('.').at(-1);
  return entry.name ? candidate === wanted : glob(wanted, candidate);
}
export function withinFunction(node, patterns, m) {
  return (
    patterns?.length &&
    m.functions.some((fn) => {
      if (
        !['function', 'macro'].includes(fn.node.kind) ||
        !fn.call ||
        fn.node === node ||
        node.range[0] < fn.node.range[0] ||
        node.range[1] > fn.node.range[1]
      )
        return false;
      const name = writtenName(invocation(fn.call).head)?.split('.').at(-1);
      return name && patterns.some((p) => glob(p, name));
    })
  );
}
export function constInitializer(node, source) {
  for (let child = node, p = source.getParent(child); p; child = p, p = source.getParent(p)) {
    if (['function', 'macro', '->', 'do'].includes(p.kind)) return false;
    if (p.kind === '=' && p.children[1] === child && source.getParent(p)?.kind === 'const')
      return true;
  }
  return false;
}
const nonempty = { type: 'string', minLength: 1 };
export const matchProperties = {
  name: nonempty,
  pattern: nonempty,
  binding: { enum: ['resolved', 'spelling'] },
  message: nonempty,
};
export const matchChoice = [
  { required: ['name'], not: { required: ['pattern'] } },
  { required: ['pattern'], not: { required: ['name'] } },
];
export function optionsSchema(properties) {
  return [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        entries: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { ...matchProperties, ...properties },
            oneOf: matchChoice,
          },
        },
        includeMacroPayloads: { type: 'boolean' },
      },
    },
  ];
}
