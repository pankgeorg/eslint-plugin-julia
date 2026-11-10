// Syntactic module resolution only: never loads a package or executes Julia.
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename, delimiter, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { parseJulia } from './parser/syntax-tree.js';
import { JuliaSourceCode } from './source-code.js';
import { getLocalScopeManager, identifierName } from './scope.js';

const inventory = JSON.parse(
  readFileSync(new URL('../data/base-core-exports.json', import.meta.url)),
);
const stdlibs = JSON.parse(
  readFileSync(new URL('../data/stdlib-exports.json', import.meta.url)),
).modules;
const factsCache = new Map(),
  graphCache = new Map(),
  tomlCache = new Map();
const hash = (text) => createHash('sha256').update(text).digest('hex');
// A file's version for the caches. Timestamps can't distinguish two same-size writes within
// one timestamp tick (coarse on some filesystems), so a recently modified file's version
// also includes its content hash, as git does for "racily clean" files.
const RACY_MS = 2000;
const stamp = (path) => {
  let s;
  try {
    s = statSync(path);
  } catch {
    return null;
  }
  const base = `${s.mtimeMs}:${s.ctimeMs}:${s.size}`;
  if (!s.isFile() || Date.now() - Math.max(s.mtimeMs, s.ctimeMs) > RACY_MS) return base;
  try {
    return `${base}:${hash(readFileSync(path))}`;
  } catch {
    return base;
  }
};
const exists = (path) => stamp(path) !== null;
const virtual = (path) => !path || /^<.*>$/u.test(path);
const textOf = (source, node) => source.getText(node).replace(/\s/gu, '');

// Only the scalar fields needed from Project/Manifest are read. Handles Manifest v1
// [[Name]] and v2 [[deps.Name]], including quoted table names. No TOML evaluation.
function toml(path, track) {
  const version = stamp(path);
  track?.set(path, version);
  if (tomlCache.get(path)?.version === version) return tomlCache.get(path).value;
  const result = { root: {}, packages: new Map() };
  let current = result.root;
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
      const table = line.match(/^\s*\[\[\s*(?:deps\.)?(?:"([^"]+)"|([\w-]+))\s*\]\]/u);
      if (table) {
        const name = table[1] ?? table[2];
        current = {};
        if (!result.packages.has(name)) result.packages.set(name, []);
        result.packages.get(name).push(current);
        continue;
      }
      if (/^\s*\[/u.test(line)) {
        current = {};
        continue;
      }
      const field = line.match(
        /^\s*(name|uuid|path|git-tree-sha1)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/u,
      );
      if (field) {
        try {
          current[field[1]] = field[2][0] === '"' ? JSON.parse(field[2]) : field[2].slice(1, -1);
        } catch {
          /* unsupported escape */
        }
      }
    }
  } catch {
    /* missing/unreadable project is unresolved */
  }
  tomlCache.set(path, { version, value: result });
  return result;
}
function upward(file) {
  const dirs = [];
  let at = dirname(file);
  for (;;) {
    dirs.push(at);
    const parent = dirname(at);
    if (parent === at) break;
    at = parent;
  }
  return dirs;
}
function projectFor(file, track) {
  for (const dir of upward(file)) {
    const path = join(dir, 'Project.toml');
    const p = toml(path, track).root;
    if (p.name) return { dir, ...p };
  }
  return null;
}
function manifestFor(file, track) {
  for (const dir of upward(file)) {
    // Project and Manifest can live above a package's own Project.toml.
    const path = join(dir, 'Manifest.toml');
    const data = toml(path, track);
    if (exists(path)) return { path, ...data };
  }
  return null;
}
function depots() {
  // An empty JULIA_DEPOT_PATH component includes the default user depot.
  return (process.env.JULIA_DEPOT_PATH ?? join(homedir(), '.julia'))
    .split(delimiter)
    .map((p) => p || join(homedir(), '.julia'))
    .map((p) => resolve(p));
}
function packageEntry(name, from, track) {
  const own = projectFor(from, track);
  if (own?.name === name) return join(own.dir, 'src', `${name}.jl`);
  const manifest = manifestFor(from, track);
  const records = manifest?.packages.get(name);
  if (!records?.length) return null;
  // Duplicate dependency names cannot be disambiguated without a UUID dependency graph.
  if (records.length !== 1) return null;
  const record = records[0];
  if (record.path) return join(resolve(dirname(manifest.path), record.path), 'src', `${name}.jl`);
  if (!record.uuid) return null;
  for (const depot of depots()) {
    const dir = join(depot, 'packages', name);
    track.set(dir, stamp(dir));
    let slugs;
    try {
      slugs = readdirSync(dir).sort();
    } catch {
      continue;
    }
    const matches = slugs.filter(
      (slug) => toml(join(dir, slug, 'Project.toml'), track).root.uuid === record.uuid,
    );
    // UUID scan is the documented alternative to Julia's version_slug. Refuse an
    // ambiguous installation rather than arbitrarily choosing a package version.
    if (matches.length === 1) return join(dir, matches[0], 'src', `${name}.jl`);
  }
  return null;
}
function literal(node, file) {
  if (node?.kind === 'string' && node.children.every((c) => c.kind === 'String')) {
    const value = node.children.map((c) => c.value).join('');
    // Decode the common literal escapes; interpolation and unsupported escapes
    // are deliberately unresolved (never interpret source as JavaScript code).
    if (/\\(?![\\"nrt])/u.test(value)) return null;
    return value.replace(/\\([\\"nrt])/gu, (_, c) => ({ n: '\n', r: '\r', t: '\t' })[c] ?? c);
  }
  if (
    node?.kind === 'macrocall' &&
    identifierName(node.children[0]) === '@__DIR__' &&
    node.children.length === 1
  )
    return dirname(file);
  if (node?.kind === 'call' && identifierName(node.children[0]) === 'joinpath') {
    const pieces = node.children.slice(1).map((n) => literal(n, file));
    if (pieces.length && pieces.every((p) => p !== null))
      return pieces.reduce((path, p) => (isAbsolute(p) ? p : join(path, p)), '');
  }
  return null;
}
function facts(source, file) {
  const manager = getLocalScopeManager(source),
    modules = [];
  const ids = new Map(
    manager.scopes
      .filter((s) => s.kind === 'module')
      .map((s) => [s, s === manager.globalScope ? -1 : s.node.range[0]]),
  );
  for (const s of manager.scopes.filter((s) => s.kind === 'module')) {
    modules.push({
      id: ids.get(s),
      parent: ids.get(s.parent?.module),
      name: s === manager.globalScope ? null : identifierName(s.node.children[0]),
      bare: s.bare,
      names: [...s.bindings.values()].map((b) => ({ name: b.name, kind: b.kind })),
      exports: [],
      imports: [],
      includes: [],
      includeMacros: [],
      macroIncludes: [],
      reads: [],
      unresolvedIncludes: false,
      dynamicEvaluation: false,
    });
  }
  const byId = new Map(modules.map((m) => [m.id, m]));
  for (const r of manager.references)
    if (r.read && (!r.binding || r.binding.scope?.kind === 'module'))
      byId.get(ids.get(r.scope.module))?.reads.push(r.name);
  for (const d of manager.definitions)
    if (['function', 'macro'].includes(d.kind) && d.binding?.scope.kind === 'module')
      byId.get(ids.get(d.binding.scope))?.reads.push(d.name);
  function walk(node, macros = []) {
    const s = manager.scopeFor(node),
      m = byId.get(ids.get(s?.module));
    // A literal call to a source-visible include wrapper can share its context.
    // Record syntax only; the macro is never expanded or executed.
    if (m && node.kind === 'macro') {
      const [signature, body] = node.children;
      if (signature?.kind === 'call' && signature.children.length === 2) {
        const parameter = signature.children[1];
        const name = identifierName(parameter.kind === '::' ? parameter.children[0] : parameter);
        const forwards = (n, depth = 0) => {
          if (['inert', 'function', 'macro', '$'].includes(n.kind)) return false;
          if (
            n.kind === 'call' &&
            depth === 1 &&
            identifierName(n.children[0]) === 'include' &&
            n.children.length === 2 &&
            n.children[1].kind === '$' &&
            identifierName(n.children[1].children[0]) === name
          )
            return true;
          return n.children.some((child) => forwards(child, depth + (n.kind === 'quote' ? 1 : 0)));
        };
        const returned = body?.children.at(-1);
        if (name && returned?.kind === 'quote' && forwards(returned))
          m.includeMacros.push(`@${identifierName(signature.children[0])}`);
      }
    }
    if (m && node.kind === 'macrocall') {
      let head = node.children[0];
      const path =
        node.children.length === 2 && s?.kind === 'module' ? literal(node.children[1], file) : null;
      if (path !== null && !virtual(file))
        m.macroIncludes.push({ name: identifierName(head), path: resolve(dirname(file), path) });
      if (
        identifierName(head) === '@eval' ||
        (head?.kind === '.' && identifierName(head.children.at(-1)) === '@eval')
      )
        m.dynamicEvaluation = true;
      if (head?.kind === 'StrMacroName') m.reads.push(`@${head.value}_str`);
      else if (identifierName(head)) m.reads.push(identifierName(head));
      else if (head?.kind === '.') {
        while (head?.kind === '.') head = head.children[0];
        if (identifierName(head)) m.reads.push(identifierName(head));
      }
    }
    if (m && ['export', 'public'].includes(node.kind) && !macros.length)
      m.exports.push(...node.children.map(identifierName).filter(Boolean));
    if (m && ['using', 'import'].includes(node.kind)) {
      for (const clause of node.children) {
        const named = clause.kind === ':';
        const path = named
          ? clause.children[0]
          : clause.kind === 'as'
            ? clause.children[0]
            : clause;
        m.imports.push({
          path: textOf(source, path),
          kind: node.kind,
          alias: clause.kind === 'as' ? textOf(source, clause.children[1]) : null,
          wildcard: !named,
          reexport: macros.includes('@reexport'),
          file,
          names: named
            ? clause.children
                .slice(1)
                .map((p) => textOf(source, p.kind === 'as' ? p.children[1] : p))
            : [],
          sourceNames: named
            ? clause.children
                .slice(1)
                .map((p) => textOf(source, p.kind === 'as' ? p.children[0] : p))
            : [],
        });
      }
    }
    if (m && node.kind === 'call') {
      const head = node.children[0];
      const name =
        identifierName(head) ?? (head?.kind === '.' ? identifierName(head.children.at(-1)) : null);
      if (['eval', 'include_string'].includes(name)) m.dynamicEvaluation = true;
      if (name === 'include') {
        const path =
          s?.kind === 'module' && identifierName(head) === 'include' && node.children.length === 2
            ? literal(node.children[1], file)
            : null;
        if (path !== null && !virtual(file))
          m.includes.push({ path: resolve(dirname(file), path), literal: path });
        else m.unresolvedIncludes = true;
      }
    }
    // Quotes are data, including their export/include-looking syntax.
    if (['quote', 'inert'].includes(node.kind)) return;
    const next = node.kind === 'macrocall' ? [...macros, identifierName(node.children[0])] : macros;
    node.children.forEach((n) => walk(n, next));
  }
  walk(source.ast);
  return modules;
}
function fileFacts(file, graph) {
  const version = stamp(file);
  graph.versions.set(file, version);
  if (graph.overlay?.file === file) return graph.overlay.facts;
  if (factsCache.get(file)?.version === version) return factsCache.get(file).facts;
  let result = [],
    digest;
  if (version) {
    try {
      const text = readFileSync(file, 'utf8'),
        parsed = parseJulia(text);
      digest = hash(text);
      if (!parsed.diagnostics.some((d) => d.level === 1))
        result = facts(new JuliaSourceCode(text, parsed), file);
    } catch {
      /* unreadable/invalid dependency contributes no names */
    }
  }
  factsCache.set(file, { version, facts: result, hash: digest });
  return result;
}
function moduleModel(name, parent, bare = false) {
  return {
    name,
    parent,
    bare,
    names: new Map(),
    children: new Map(),
    includeMacros: new Set(),
    exports: new Set(),
    imports: [],
    unknown: new Set(),
    unknownExports: false,
    reads: new Set(),
    unresolvedIncludes: false,
    dynamicEvaluation: false,
  };
}
function addFile(graph, file, into, active = new Set()) {
  // Path-based stack also stops cycles that enter a freshly nested module.
  if (active.has(file)) return true;
  const modules = fileFacts(file, graph);
  if (!modules.length) return false;
  const next = new Set(active).add(file),
    map = new Map([[-1, into]]);
  if (!graph.files.has(file)) graph.files.set(file, []);
  for (const fact of modules) {
    let m = into;
    if (fact.id !== -1) {
      const parent = map.get(fact.parent) ?? into;
      if (!parent.children.has(fact.name))
        parent.children.set(fact.name, moduleModel(fact.name, parent, fact.bare));
      m = parent.children.get(fact.name);
      map.set(fact.id, m);
    }
    graph.files.get(file).push({ id: fact.id, module: m });
    for (const b of fact.names) m.names.set(b.name, b.kind);
    for (const name of fact.exports) m.exports.add(name);
    m.imports.push(...fact.imports.map((imp) => ({ ...imp })));
    fact.reads.forEach((name) => m.reads.add(name));
    m.unresolvedIncludes ||= fact.unresolvedIncludes;
    m.dynamicEvaluation ||= fact.dynamicEvaluation;
    fact.includeMacros.forEach((name) => m.includeMacros.add(name));
    for (const include of fact.includes) {
      let included = include.path;
      // Base's bootstrap include is cwd-relative, before it installs Julia's
      // ordinary per-file include. Recognize its base/ rooted literal paths.
      if (graph.baseDir && !isAbsolute(include.literal)) {
        graph.versions.set(included, stamp(included));
        if (!exists(included)) included = resolve(graph.baseDir, include.literal);
      }
      if (!addFile(graph, included, m, next)) m.unresolvedIncludes = true;
    }
    for (const include of fact.macroIncludes)
      if (m.includeMacros.has(include.name)) {
        if (!addFile(graph, include.path, m, next)) m.unresolvedIncludes = true;
      }
  }
  return true;
}
function graphFor(entries, overlay) {
  const key = JSON.stringify([entries, depots(), overlay?.file, overlay?.hash]);
  const previous = graphCache.get(key);
  if (previous && [...previous.versions].every(([p, v]) => stamp(p) === v)) return previous;
  const baseEntry = entries.find(
    (p) => basename(p) === 'Base.jl' && basename(dirname(p)) === 'base',
  );
  const graph = {
    root: moduleModel('Main', null),
    files: new Map(),
    versions: new Map(),
    overlay,
    entries,
    baseDir: baseEntry && dirname(baseEntry),
  };
  for (const entry of entries) addFile(graph, entry, graph.root);
  // Keep models compact: source trees/SourceCode objects never enter this cache.
  delete graph.overlay;
  graphCache.set(key, graph);
  // Editor buffers may produce many distinct hashes.
  if (graphCache.size > 128) graphCache.delete(graphCache.keys().next().value);
  return graph;
}
function entryCandidates(file, context, track) {
  const candidates = [];
  const configured = context.settings?.julia?.entryFiles;
  if (Array.isArray(configured)) {
    // One include universe per configured entry; multiple entries can share Base.
    for (const entry of configured)
      if (typeof entry === 'string') candidates.push([resolve(entry)]);
  }
  const project = projectFor(file, track);
  if (project) {
    candidates.push([join(project.dir, 'src', `${project.name}.jl`)]);
    candidates.push([join(project.dir, 'test', 'runtests.jl')]);
  }
  for (const dir of upward(file)) {
    if (basename(dir) === 'base' && exists(join(dir, 'Base.jl'))) {
      candidates.push(
        ['Base.jl', 'Base_compiler.jl', 'sysimg.jl', 'compiler/compiler.jl']
          .map((p) => join(dir, p))
          .filter(exists),
      );
      break;
    }
    // Julia source-tree stdlibs without a package Project.toml.
    if (basename(dirname(dir)) === 'stdlib')
      candidates.push([join(dir, 'src', `${basename(dir)}.jl`)]);
  }
  return candidates;
}
function findModule(path, from, graph, state) {
  const dots = path.match(/^\.+/u)?.[0].length ?? 0;
  const parts = path.slice(dots).split('.').filter(Boolean);
  if (dots) {
    let at = from;
    for (let i = 1; i < dots && at; i++) at = at.parent;
    for (const [i, part] of parts.entries()) {
      const child = at?.children.get(part) ?? (at?.name === part ? at : null);
      if (child || !at) {
        at = child;
        continue;
      }
      // `..TOML` where the parent did `import TOML`/`using TOML`: follow that import.
      const via = at.imports.find(
        (imp) => !imp.names.length && (imp.alias ?? imp.path.split('.').at(-1)) === part,
      );
      if (!via || (state.depth ?? 0) > 16) return null;
      const target = findModule(via.path, at, graph, { ...state, depth: (state.depth ?? 0) + 1 });
      if (!target) return null;
      const rest = parts.slice(i + 1);
      if (!rest.length) return target;
      return target.module
        ? findModule(`.${rest.join('.')}`, target.module, graph, state)
        : (stdlibInventory(`${target.key}.${rest.join('.')}`) ?? null);
    }
    return at ? { exports: at.exports, module: at } : null;
  }
  const name = parts.shift();
  if (!parts.length && Object.hasOwn(inventory, name))
    return { exports: new Set(inventory[name]), key: name };
  // Standard libraries and Base/Core/stdlib submodules (`Base.BinaryPlatforms`, `LinearAlgebra.BLAS`).
  const known = stdlibInventory([name, ...parts].join('.'));
  if (known) return known;
  let at = graph.root.children.get(name);
  if (!at) {
    const entry = packageEntry(name, state.file, graph.versions);
    if (!entry) return null;
    const dependency = graphFor([entry]);
    solve(dependency, state);
    for (const [p, v] of dependency.versions) graph.versions.set(p, v);
    at = dependency.root.children.get(name);
  }
  for (const part of parts) at = at?.children.get(part);
  return at ? { exports: at.exports, module: at } : null;
}
function stdlibInventory(key) {
  return Object.hasOwn(stdlibs, key) ? { exports: new Set(stdlibs[key]), key } : null;
}
function allModules(root) {
  return [root, ...[...root.children.values()].flatMap(allModules)];
}
function solve(graph, state) {
  if (graph.solved || state.active.has(graph)) return;
  state.active.add(graph);
  const modules = allModules(graph.root);
  // Monotone fixed point handles relative imports and re-export cycles.
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of modules) {
      m.unknown.clear();
      for (const imp of m.imports) {
        const target = findModule(imp.path, m, graph, { ...state, file: imp.file });
        const uncertain = !target || target.module?.unknownExports;
        imp.resolvedExports = uncertain ? undefined : target.exports;
        if (uncertain) {
          // Only `using M` can bring in unknown names: an unresolved `import M`/`import ..f`
          // binds just the written name (and may not even be a module).
          if (imp.wildcard && imp.kind !== 'import') m.unknown.add(imp.path);
          if (imp.reexport && !m.unknownExports) {
            m.unknownExports = true;
            changed = true;
          }
        }
        if (!target) continue;
        const names = imp.wildcard ? target.exports : imp.names;
        if (target.module && !imp.wildcard)
          imp.sourceNames.forEach((name) => target.module.reads.add(name));
        for (const name of names) {
          if (!m.names.has(name)) {
            m.names.set(name, 'import');
            changed = true;
          }
          if (imp.reexport && !m.exports.has(name)) {
            m.exports.add(name);
            changed = true;
          }
        }
      }
    }
  }
  state.active.delete(graph);
  graph.solved = true;
}

export function applyModuleResolution(manager, source, context = {}) {
  const file = virtual(context.physicalFilename) ? '<input>' : resolve(context.physicalFilename);
  const ownFacts = facts(source, file);
  const overlay = { file, facts: ownFacts, hash: hash(source.text) };
  const discovery = new Map();
  let graph, occurrences;
  if (!virtual(file))
    for (const entries of entryCandidates(file, context, discovery)) {
      let candidate = graphFor(entries);
      if (candidate.files.has(file) && factsCache.get(file)?.hash !== overlay.hash)
        candidate = graphFor(entries, overlay);
      if (candidate.files.has(file)) {
        graph = candidate;
        occurrences = candidate.files.get(file);
        break;
      }
    }
  if (!graph) {
    graph = virtual(file) ? graphFor([file], overlay) : graphFor([file]);
    if (!virtual(file) && factsCache.get(file)?.hash !== overlay.hash)
      graph = graphFor([file], overlay);
    occurrences = graph.files.get(file) ?? [];
  }
  for (const [p, v] of discovery) graph.versions.set(p, v);
  solve(graph, { active: new Set(), file });
  manager.moduleResolution = {
    entries: graph.entries,
    files: [...graph.files.keys()],
    scopes: new Map(),
  };
  for (const s of manager.scopes.filter((s) => s.kind === 'module')) {
    const id = s === manager.globalScope ? -1 : s.node.range[0];
    const models = [...new Set(occurrences.filter((o) => o.id === id).map((o) => o.module))];
    s.bareUsing = [...new Set(models.flatMap((m) => [...m.unknown]))];
    manager.moduleResolution.scopes.set(s, models);
    for (const m of models) {
      if (s === manager.globalScope && m.parent) s.bare = m.bare;
      for (const [name, kind] of m.names)
        if (!s.bindings.has(name))
          s.bindings.set(name, {
            name,
            kind: kind === 'import' ? 'import' : 'module-member',
            scope: s,
            definitions: [],
            references: [],
            writes: [],
            constant: false,
            external: true,
          });
    }
  }
}
