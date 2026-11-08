import { readFileSync } from 'node:fs';
import { applyModuleResolution } from './module-resolution.js';
import { isInfixCall } from './parser/flags.js';

const inventory = JSON.parse(readFileSync(new URL('../data/base-core-exports.json', import.meta.url)));
const core = new Set([...inventory.Core, 'ccall']), base = new Set(inventory.Base);
const builtin = new Map([...base, ...core, 'include', 'eval'].map(name => [name,
  { name, kind: 'builtin', builtin: core.has(name) ? 'Core' : 'Base', definitions: [], references: [], writes: [] }]));
const cache = new WeakMap(), localCache = new WeakMap(), owners = new WeakMap();
export const identifierName = node => node?.kind === 'Identifier' ? node.value
  : node?.kind === 'var' ? node.children[0]?.value
  : node?.kind === 'macro_name' ? `@${node.children[0]?.value}` : null;
export function bindingNames(node) {
  if (!node) return [];
  if (identifierName(node) !== null) return [node.kind === 'var' ? node.children[0] : node];
  if (['tuple', 'parameters', 'parens', 'block'].includes(node.kind)) return node.children.flatMap(bindingNames);
  if (node.kind === 'comparison' && node.children.length === 5) return bindingNames(node.children[2]);
  if (node.kind === 'macrocall' && ['@nospecialize', '@specialize'].includes(identifierName(node.children[0]))) return node.children.slice(1).flatMap(bindingNames);
  if (['=', '...', 'outer', '<:', '>:'].includes(node.kind)) return bindingNames(node.children[0]);
  if (node.kind === '::' && node.children.length === 2) return bindingNames(node.children[0]);
  return [];
}
// Resolution context is the ESLint rule context (physicalFilename + settings).
export function getScopeManager(sourceCode, context = {}) {
  const key = JSON.stringify([context.physicalFilename, context.settings?.julia?.entryFiles, process.env.JULIA_DEPOT_PATH]);
  if (!cache.has(sourceCode)) cache.set(sourceCode, new Map());
  const managers = cache.get(sourceCode);
  if (!managers.has(key)) managers.set(key, analyze(sourceCode, context));
  return managers.get(key);
}
// Internal, filesystem-free pass used to extract facts from dependency syntax trees.
export function getLocalScopeManager(sourceCode) {
  if (!localCache.has(sourceCode)) localCache.set(sourceCode, analyze(sourceCode, null));
  return localCache.get(sourceCode);
}
export const resolve = node => owners.get(node)?.resolve(node) ?? null;
export const isReadReference = node => owners.get(node)?.referenceFor(node)?.read === true;
export const isUnshadowedBuiltin = (node, name) => owners.get(node)?.isUnshadowedBuiltin(node, name) ?? false;

function analyze(source, context) {
  const scopes = [], references = [], definitions = [], nodeScopes = new WeakMap(), nodeReferences = new WeakMap();
  const nodeDefinitions = new WeakMap(), functions = [], exports = [], imports = [];
  function scope(kind, node, parent, extra = {}) {
    const s = { kind, node, parent, bindings: new Map(), declarations: new Map(), candidates: [], children: [],
      bareUsing: [], dynamic: false, ...extra };
    s.module = kind === 'module' ? s : parent.module;
    scopes.push(s); parent?.children.push(s); return s;
  }
  const root = scope('module', source.ast, null, { bare: false });
  function mark(node, s) { nodeScopes.set(node, s); owners.set(node, manager); }
  function ref(node, s, read = true, extra = {}) {
    if (!node) return;
    mark(node, s);
    const r = { node, name: identifierName(node), scope: s, read, write: !read, ...extra, binding: null };
    references.push(r); nodeReferences.set(node, r); return r;
  }
  function define(node, s, kind, extra = {}) {
    if (!node || (extra.name ?? identifierName(node)) === null || /^_+$/u.test(identifierName(node) ?? '')) return;
    mark(node, s);
    const d = { node, name: identifierName(node), scope: s, kind, ...extra, binding: null };
    definitions.push(d); s.candidates.push(d); nodeDefinitions.set(node, d); return d;
  }
  function signatureScope(s) {
    return s.signatureScope ??= scope('signature', s.node, s.parent,
      { aliasesFrom: s, transparent: s.kind === 'function' });
  }
  function defaulted(node) {
    if (node.kind === '=') return true;
    if (node.kind === '::') return node.children.length === 2 && defaulted(node.children[0]);
    return ['tuple', 'parens', '...', 'macrocall'].includes(node.kind) && node.children.some(defaulted);
  }
  function pattern(node, s, kind, extra = {}) {
    if (!node) return;
    mark(node, s);
    const name = identifierName(node);
    if (name !== null) { define(node.kind === 'var' ? node.children[0] : node, s, kind, extra); return; }
    if (node.kind === 'macrocall' && ['@nospecialize', '@specialize'].includes(identifierName(node.children[0]))) {
      node.children.slice(1).forEach(n => pattern(n, s, kind, extra));
    } else if (['tuple', 'parameters', 'parens', 'block'].includes(node.kind)) {
      for (const c of node.children) pattern(c, s, kind, extra);
    } else if (['...', 'outer'].includes(node.kind)) {
      pattern(node.children[0], s, kind, { ...extra, outer: node.kind === 'outer' || extra.outer });
    } else if (node.kind === '::') {
      if (node.children.length === 2) pattern(node.children[0], s, kind, { ...extra, typed: true });
      visit(node.children.at(-1), extra.typeScope ?? s);
    } else if (node.kind === '=') {
      visit(node.children[1], extra.defaultScope ?? s); pattern(node.children[0], s, kind, extra);
    } else visit(node, s); // property/index mutation reads its receiver and indices
  }
  function typeParameters(nodes, s) {
    const params = nodes.flatMap(n => n.kind === 'braces' ? n.children : [n]);
    for (const p of params) for (const n of bindingNames(p)) define(n, s, 'type-parameter', { parameter: p, force: true });
    for (const p of params) {
      mark(p, s);
      if (['<:', '>:'].includes(p.kind)) p.children.slice(1).forEach(n => visit(n, signatureScope(s)));
      else if (p.kind === 'comparison') { // lower < T <: upper
        visit(p.children[0], signatureScope(s)); visit(p.children.at(-1), signatureScope(s));
      }
    }
    return params;
  }
  function signature(sig, s, outer, fn) {
    mark(sig, s);
    if (sig.kind === 'where') {
      fn.typeParameters.push(...typeParameters(sig.children.slice(1), s));
      return signature(sig.children[0], s, outer, fn);
    }
    if (sig.kind === '::' && sig.children.length === 2) {
      visit(sig.children[1], s); return signature(sig.children[0], s, outer, fn);
    }
    if (sig.kind === 'parens' && sig.children.length === 1) return signature(sig.children[0], s, outer, fn);
    let args;
    if (fn.node.kind === 'function' && identifierName(sig) !== null) {
      define(sig.kind === 'var' ? sig.children[0] : sig, outer, 'function', { assignment: fn.node });
      return;
    }
    if (sig.kind === 'call') {
      let head = sig.children[isInfixCall(sig) ? 1 : 0];
      if (head?.kind === 'curly') { head.children.slice(1).forEach(n => visit(n, signatureScope(s))); head = head.children[0]; }
      if (identifierName(head) !== null) {
        const n = head.kind === 'var' ? head.children[0] : head;
        define(n, outer, fn.node.kind === 'macro' ? 'macro' : 'function', { assignment: fn.node,
          name: fn.node.kind === 'macro' ? `@${identifierName(n)}` : identifierName(n) });
      } else if (head?.kind === '.' ) visit(head.children[0], outer);
      else argument(head, false);
      args = sig.children.filter(c => c !== sig.children[isInfixCall(sig) ? 1 : 0]);
      fn.call = sig;
    } else args = ['tuple', 'parameters'].includes(sig.kind) ? sig.children : [sig];
    for (const arg of args) {
      if (arg.kind === 'parameters') for (const a of arg.children) argument(a, true);
      else argument(arg, false);
    }
    function argument(arg, keyword) {
      if (!arg) return;
      // Defaults run in wrapper methods: earlier parameters are aliases, body locals are unavailable.
      const prior = s.candidates.filter(d => ['argument', 'keyword', 'type-parameter', 'implicit-argument'].includes(d.kind));
      const defaults = defaulted(arg) ? scope('default', arg, outer, { aliasDefinitions: prior }) : null;
      const names = bindingNames(arg);
      pattern(arg, s, keyword ? 'keyword' : 'argument', { force: true, parameter: arg, assignment: arg,
        defaultScope: defaults ?? outer, typeScope: signatureScope(s) });
      fn.arguments.push(...names.map(n => nodeDefinitions.get(n)).filter(Boolean));
    }
  }
  function iteration(clause, s) {
    if (clause.kind === 'filter') {
      s = iteration(clause.children[0], s);
      clause.children.slice(1).forEach(n => visit(n, s)); return s;
    }
    if (clause.kind !== 'iteration') { visit(clause, s); return s; }
    for (const pair of clause.children) {
      visit(pair.children[1], s);
      s = scope('for', pair, s);
      pattern(pair.children[0], s, 'iteration', { force: true, assignment: pair });
    }
    return s;
  }
  function quoted(node, s, depth) {
    mark(node, s);
    if (node.kind === '$') {
      if (depth === 1) node.children.forEach(n => visit(n, s));
      else node.children.forEach(n => quoted(n, s, depth - 1));
    } else node.children.forEach(n => quoted(n, s, depth + (n.kind === 'quote' ? 1 : 0)));
  }
  function importStatement(node, s) {
    s = s.module;
    for (const clause of node.children) {
      const named = clause.kind === ':', paths = named ? clause.children.slice(1) : [clause];
      const pathText = p => source.getText(p).replace(/\s/gu, '');
      const moduleName = named ? pathText(clause.children[0]) : pathText(clause.kind === 'as' ? clause.children[0] : clause);
      if (node.kind === 'using' && !named) s.bareUsing.push(moduleName);
      for (const p of paths) {
        const target = p.kind === 'as' ? p.children[1] : p.children.at(-1);
        if (!target) continue;
        const d = define(target, s, 'import', { force: true, moduleName, named, importKind: node.kind, imported: source.getText(p), assignment: node });
        if (d) imports.push(d);
      }
    }
  }
  function visit(node, s, extra = {}) {
    if (!node) return;
    mark(node, s);
    if (identifierName(node) !== null && node.kind !== 'macro_name') {
      const n = node.kind === 'var' ? node.children[0] : node;
      if (['end', 'begin'].includes(n.originalKind)) return;
      ref(n, s, true, extra); return;
    }
    if (!node.interior && node.kind !== 'JuliaFile') return;
    const c = node.children;
    switch (node.kind) {
      case 'quote': case 'inert': quoted(node, s, 1); return;
      case 'macro_name': return;
      case 'macrocall': {
        // The argument asks whether a binding exists; it does not read its value.
        if (identifierName(c[0]) === '@isdefined') return;
        s.dynamic = true;
        if (c[0]?.kind === '.') visit(c[0].children[0], s.module); // compile-time namespace lookup; never consumes a runtime local
        const macroName = c[0]?.kind === '.' ? identifierName(c[0].children[1]) : identifierName(c[0]);
        // Pluto's @bind evaluates the widget and assigns the named global.
        if (macroName === '@bind' && c.length === 3 && identifierName(c[1]) !== null) {
          visit(c[2], s);
          pattern(c[1], s, 'assignment', { declaration: 'global', assignment: node, initialized: true });
          return;
        }
        // Written normal declarations still count; naked DSL operands are opaque reads.
        const assignmentMacro = ['@views', '@view', '@inbounds', '@inline', '@noinline', '@time', '@elapsed',
          '@allocated', '@allocations', '@show', '@showtime', '@assert', '@boundscheck', '@timed', '@sync', '@async', '@spawn', '@simd', '@fastmath', '@__dot__', '@eval'].includes(macroName);
        for (const [index, arg] of c.slice(1).entries()) {
          const firstExpression = index === 0 && ['@test', '@test_broken', '@test_skip', '@error', '@warn', '@info', '@debug', '@logmsg'].includes(macroName);
          if (!assignmentMacro && !firstExpression && arg.kind === '=') visit(arg.children[1], s, { opaque: true });
          else visit(arg, s, { opaque: true });
        }
        return;
      }
      case 'module': {
        define(c[0], s.module, 'module', { force: true, assignment: node });
        if (identifierName(c[0]) === null) visit(c[0], s, extra);
        const inner = scope('module', node, s, { bare: Boolean(node.flags & 256) });
        define(c[0], inner, 'module-self', { force: true });
        visit(c[1], inner); return;
      }
      case 'function': case 'macro': case '->': case 'do': {
        const inner = scope('function', node, s);
        const fn = { node, scope: inner, arguments: [], typeParameters: [], call: null }; functions.push(fn);
        if (node.kind === 'macro') for (const name of ['__module__', '__source__'])
          define({ kind: 'Identifier', value: name, range: node.range, loc: node.loc }, inner, 'implicit-argument', { force: true });
        if (['function', 'macro'].includes(node.kind) && identifierName(c[0]) !== null)
          define(c[0], s, node.kind, { assignment: node, name: node.kind === 'macro' ? `@${identifierName(c[0])}` : identifierName(c[0]) });
        else signature(c[0], inner, s, fn);
        visit(c[1], inner); return;
      }
      case 'struct': case 'abstract': case 'primitive': {
        const inner = scope('type', node, s);
        let head = c[0];
        if (head?.kind === '<:') { visit(head.children[1], signatureScope(inner)); head = head.children[0]; }
        if (head?.kind === 'curly') { typeParameters(head.children.slice(1), inner); head = head.children[0]; }
        inner.typeDefinition = define(head, s, 'type', { assignment: node });
        inner.typeName = identifierName(head);
        if (node.kind === 'struct') {
          define({ kind: 'Identifier', value: 'new', range: head.range, loc: head.loc }, inner, 'intrinsic', { force: true });
          const body = c.at(-1); mark(body, inner);
          for (let field of body.children) {
            if (field.kind === 'const') field = field.children[0];
            if (identifierName(field) !== null) continue;
            if (field.kind === '::') visit(field.children.at(-1), signatureScope(inner));
            else if (field.kind === '=' && ['Identifier', '::'].includes(field.children[0]?.kind)) {
              if (field.children[0].kind === '::') visit(field.children[0].children.at(-1), signatureScope(inner));
              visit(field.children[1], inner);
            } else visit(field, inner);
          }
        } else c.slice(1).forEach(n => visit(n, inner));
        return;
      }
      case 'where': {
        const inner = scope('where', node, s); typeParameters(c.slice(1), inner); visit(c[0], inner); return;
      }
      case 'let': {
        let inner = scope('let', node, s);
        for (const item of c[0].children) {
          if (item.kind === '=') visit(item.children[1], inner);
          const next = scope('let', item, inner);
          pattern(item.kind === '=' ? item.children[0] : item, next, 'let', { force: true, assignment: item });
          inner = next;
        }
        visit(c[1], inner); return;
      }
      case 'for': { visit(c[1], iteration(c[0], s)); return; }
      case 'generator': {
        let inner = scope('comprehension', node, s);
        for (const clause of c.slice(1)) inner = iteration(clause, inner);
        visit(c[0], inner); return;
      }
      case 'while': { const inner = scope('while', node, s); c.forEach(n => visit(n, inner)); return; }
      case 'try': {
        for (const part of c) {
          const inner = scope('try', part, s);
          if (part.kind === 'catch') {
            if (part.children.length > 1) pattern(part.children[0], inner, 'catch', { force: true, assignment: part });
            visit(part.children.at(-1), inner);
          } else visit(part, inner);
        }
        return;
      }
      case 'local': case 'global': case 'const':
        for (const item of c) declaration(item, s, { ...extra,
          ...(node.kind === 'const' ? { constant: true } : { declaration: node.kind }), assignment: item });
        return;
      case 'import': case 'using': importStatement(node, s); return;
      case 'export': case 'public':
        for (const n of c) exports.push({ node: n, name: identifierName(n), scope: s.module }); return;
      case '=': case 'op=': case '.=':
        if (node.kind === '.=') { c.forEach(n => visit(n, s, extra)); return; }
        if (node.kind === '=' && c[0]?.kind === 'curly') {
          const inner = scope('where', node, s); typeParameters(c[0].children.slice(1), inner);
          pattern(c[0].children[0], s, 'assignment', { ...extra, assignment: node, initialized: true });
          visit(c[1], inner); return;
        }
        visit(c.at(-1), s, extra);
        if (node.kind === 'op=') { visit(c[1], s, extra); for (const n of bindingNames(c[0])) ref(n, s, true, extra); }
        pattern(c[0], s, 'assignment', { ...extra, assignment: node, initialized: true }); return;
      case '.': visit(c[0], s, extra); return;
      case 'ref': case 'call': case 'dotcall':
        if (['include', 'eval', 'include_string'].includes(identifierName(c[0]))
          || c[0]?.kind === '.' && ['include', 'eval', 'include_string'].includes(identifierName(c[0].children[1]))) s.dynamic = true;
        for (const arg of c) {
          if (arg.kind === '=' && identifierName(arg.children[0]) !== null) visit(arg.children[1], s, extra);
          else visit(arg, s, extra);
        }
        return;
      case 'parameters':
        for (const item of c) {
          if (item.kind === '=') visit(item.children[1], s, extra); else visit(item, s, extra);
        }
        return;
      case 'tuple':
        for (const item of c) {
          if (item.kind === '=') visit(item.children[1], s, extra); else visit(item, s, extra);
        }
        return;
      default: c.forEach(n => visit(n, s, extra));
    }
  }
  function declaration(node, s, extra) {
    mark(node, s);
    if (['const', 'global', 'local'].includes(node.kind)) {
      for (const n of node.children) declaration(n, s, { ...extra,
        ...(node.kind === 'const' ? { constant: true } : { declaration: node.kind }) });
    } else if (node.kind === 'op=') {
      visit(node.children.at(-1), s); visit(node.children[1], s);
      for (const n of bindingNames(node.children[0])) ref(n, s);
      pattern(node.children[0], s, 'assignment', { ...extra, assignment: node, initialized: true });
    } else if (node.kind === '=') {
      if (node.children[0]?.kind === 'curly') {
        const inner = scope('where', node, s); typeParameters(node.children[0].children.slice(1), inner);
        visit(node.children[1], inner); pattern(node.children[0].children[0], s, 'assignment', { ...extra, assignment: node, initialized: true });
      } else { visit(node.children[1], s); pattern(node.children[0], s, 'assignment', { ...extra, assignment: node, initialized: true }); }
    } else pattern(node, s, 'declaration', { ...extra, force: extra.declaration === 'local' });
  }
  function lookup(name, s) {
    for (let at = s; at; at = at.parent) {
      const b = at.bindings.get(name);
      if (b) return b;
      if (at.kind === 'module') return (!at.bare || at.bareUsing.includes('Base') || core.has(name)) ? builtin.get(name) ?? null : null;
    }
    return null;
  }
  function localOuter(name, s) {
    for (let at = s.parent; at && at.kind !== 'module'; at = at.parent) if (at.bindings.has(name)) {
      const b = at.bindings.get(name);
      if (b.scope.kind !== 'module' || at.declarations.get(name) === 'global') return b;
    }
    return null;
  }
  function makeBinding(d, s) {
    if (!s.bindings.has(d.name)) s.bindings.set(d.name, { name: d.name, kind: d.kind, scope: s,
      definitions: [], references: [], writes: [], constant: false });
    return s.bindings.get(d.name);
  }
  const manager = { scopes, references, definitions, functions, exports, imports, globalScope: root,
    scopeFor: node => nodeScopes.get(node), referenceFor: node => nodeReferences.get(node) ?? (node?.kind === 'var' ? nodeReferences.get(node.children[0]) : undefined),
    definitionFor: node => nodeDefinitions.get(node),
    resolve(node) { return nodeDefinitions.get(node)?.binding ?? nodeReferences.get(node)?.binding
      ?? (node?.kind === 'var' ? this.resolve(node.children[0]) : null); },
    lookup: (name, s = root) => lookup(name, s),
    isReadReference(node) { return this.referenceFor(node)?.read === true; },
    isUnshadowedBuiltin(node, name) {
      const trusted = (binding, target) => {
        if (!binding) return false;
        if (binding.kind === 'builtin') return binding.name === target;
        return !binding.writes.length && binding.definitions.some(d => d.kind === 'import'
          && ['Base', 'Core'].includes(d.moduleName)
          && d.imported.split(/\s+as\s+/u)[0].split('.').at(-1).trim() === target
          && (d.moduleName === 'Core' ? core : base).has(target));
      };
      if (identifierName(node) !== null) return trusted(this.resolve(node), name);
      if (node?.kind !== '.' || identifierName(node.children[1]) !== name) return false;
      const receiver = this.resolve(node.children[0]);
      const namespace = ['Base', 'Core'].find(n => trusted(receiver, n));
      return Boolean(namespace && (namespace === 'Core' ? core : base).has(name));
    },
  };
  if (source.diagnostics.some(d => d.level === 1)) return manager;
  visit(source.ast, root);
  // Static method type expressions run in the outer value environment. Type-parameter
  // aliases stay local; other written definitions belong to the enclosing scope.
  for (const s of scopes.filter(s => s.transparent)) {
    const retained = [];
    for (const d of s.candidates) {
      let target = s;
      while (target.transparent && d.declaration !== 'local'
        && !target.aliasesFrom.candidates.some(p => p.kind === 'type-parameter' && p.name === d.name)) target = target.parent;
      if (target === s) retained.push(d);
      else { d.scope = target; target.candidates.push(d); }
    }
    s.candidates = retained;
  }
  // Declarations are scope-wide, even when written after assignments.
  for (const d of definitions) if (d.declaration) d.scope.declarations.set(d.name, d.declaration);
  // Parent scopes are finalized first; a later parent assignment is still captured.
  for (const s of scopes) {
    for (const d of s.aliasDefinitions ?? s.aliasesFrom?.candidates.filter(d => d.kind === 'type-parameter') ?? [])
      if (d.binding) s.bindings.set(d.name, d.binding);
    const ordered = [...s.candidates].sort((a, b) => Number(Boolean(b.force)) - Number(Boolean(a.force)));
    for (const d of ordered) {
      const declaration = s.declarations.get(d.name);
      let b;
      if (declaration === 'global' || d.declaration === 'global') {
        b = makeBinding(d, s.module);
        if (s !== s.module) s.bindings.set(d.name, b); // lexical global declaration, inherited by descendants
      }
      else if (s.kind === 'type' && d.kind === 'function' && d.name === s.typeName && s.typeDefinition?.binding) {
        b = s.typeDefinition.binding; s.bindings.set(d.name, b);
      }
      else if (s.bindings.has(d.name)) b = s.bindings.get(d.name);
      else if (d.force && !d.outer || declaration === 'local' || s.kind === 'module') b = makeBinding(d, s);
      else b = localOuter(d.name, s) ?? makeBinding(d, s);
      d.binding = b; b.definitions.push(d); b.constant ||= Boolean(d.constant);
      if (d.initialized) b.writes.push(d);
    }
  }
  if (context) {
    applyModuleResolution(manager, source, context);
    for (const record of [...definitions, ...references]) owners.set(record.node, manager);
  }
  for (const r of references) {
    const declaration = r.scope.declarations.get(r.name);
    r.binding = lookup(r.name, declaration === 'global' ? r.scope.module : r.scope);
    if (r.binding && r.binding.kind !== 'builtin') r.binding.references.push(r);
  }
  for (const s of scopes) for (const b of s.bindings.values()) {
    b.definitions.sort((a, b) => a.node.range[0] - b.node.range[0]);
    b.writes.sort((a, b) => a.node.range[0] - b.node.range[0]);
  }
  return manager;
}
