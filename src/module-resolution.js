// Syntactic module resolution only: never loads a package or executes Julia.
import { readFileSync, statSync, readdirSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, dirname, join, basename, delimiter, isAbsolute, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { parseJulia } from './parser/syntax-tree.js';
import { JuliaSourceCode } from './source-code.js';
import { getLocalScopeManager, identifierName } from './scope.js';
import { resolveEnvironment } from './resolver/index.js';

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
  const result = { root: {}, packages: new Map(), deps: new Set() };
  let current = result.root,
    deps = false;
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
        deps = /^\s*\[\s*deps\s*\]/u.test(line);
        continue;
      }
      // Project `[deps]` names, for deciding whether the environment can supply a package.
      const dep = deps && line.match(/^\s*(?:"([^"]+)"|([\w-]+))\s*=/u);
      if (dep) result.deps.add(dep[1] ?? dep[2]);
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
// The environment resolver (settings.julia.resolver): a throwaway, cached, source-only
// copy of the linted file's environment, asked for once, when a package isn't installed.
function environmentFor(file, settings, track) {
  let projectFile = null;
  for (const dir of upward(file)) {
    const path = join(dir, 'Project.toml');
    if (exists(path)) {
      projectFile = path;
      break;
    }
  }
  if (!projectFile) return null;
  const dir = dirname(projectFile);
  const manifestFile =
    ['Manifest-v1.13.toml', 'Manifest.toml'].map((m) => join(dir, m)).find(exists) ?? null;
  const result = resolveEnvironment(
    { projectFile, manifestFile, packageName: projectFor(file, track)?.name },
    settings,
  );
  if (result?.envDir) {
    const marker = join(result.envDir, 'env.json');
    track.set(marker, stamp(marker));
  }
  return result;
}
// Entries that came from the resolver's cache, with the folder of their export index.
const indexed = new Map();
function packageEntry(name, from, track, state = {}) {
  const local = installedEntry(name, from, track);
  if (local || !state.environment || !state.dependsOn?.(name)) return local;
  const environment = state.environment();
  const entry = environment?.packages?.[name]?.entry;
  if (!entry || !exists(entry)) return null;
  // Only the resolver's own, content-addressed copies are indexed (a `path` dependency is
  // the developer's editable directory). Re-exports depend on the environment's versions,
  // so the index is per environment.
  const cache = environment.envDir && dirname(dirname(environment.envDir));
  if (cache && entry.startsWith(join(cache, 'depot', 'packages') + sep))
    indexed.set(entry, { dir: join(cache, 'index'), key: environment.key ?? environment.envDir });
  return entry;
}
// The export index of a cached, immutable package source tree: its solved module tree
// (exports and submodules), so later runs don't parse the package again.
const INDEX_VERSION = 3;
const { version: pluginVersion } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)),
);
const indexFile = (entry) => {
  const { dir, key } = indexed.get(entry);
  const id = [INDEX_VERSION, pluginVersion, stdlibs.julia ?? '', key, entry, variant].join('\0');
  return join(dir, `${hash(id).slice(0, 24)}.json`);
};
const indexMemo = new Map();
function loadIndex(entry) {
  if (!indexed.has(entry)) return null;
  if (indexMemo.has(entry)) return indexMemo.get(entry);
  let data;
  try {
    data = JSON.parse(readFileSync(indexFile(entry), 'utf8'));
  } catch {
    return null;
  }
  const build = (d, parent) => {
    const m = moduleModel(d.name, parent);
    d.exports.forEach((n) => m.exports.add(n));
    m.unknownExports = Boolean(d.unknownExports);
    // An index lists exports only, not every name the module defines.
    m.indexed = true;
    for (const c of d.children) m.children.set(c.name, build(c, m));
    return m;
  };
  const model =
    data.version === INDEX_VERSION && data.entry === entry ? build(data.module, null) : null;
  indexMemo.set(entry, model);
  return model;
}
function storeIndex(entry, model) {
  if (!indexed.has(entry) || !model) return;
  const dump = (m) => ({
    name: m.name,
    exports: [...m.exports],
    unknownExports: m.unknownExports || m.dynamicExports,
    children: [...m.children.values()].map(dump),
  });
  try {
    const file = indexFile(entry);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      `${file}.${process.pid}.tmp`,
      JSON.stringify({ version: INDEX_VERSION, entry, module: dump(model) }),
    );
    renameSync(`${file}.${process.pid}.tmp`, file);
  } catch {
    /* An unwritable cache only costs a re-parse. */
  }
}
function installedEntry(name, from, track) {
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
  const manager = getLocalScopeManager(source, currentMacros),
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
      // Module-level names an unknown macro declares (`@verbosity_specifier V begin … end`)
      // are visible to sibling files too.
      names: [...s.bindings.values(), ...(s.macroBindings?.values() ?? [])].map((b) => ({
        name: b.name,
        kind: b.kind,
      })),
      exports: [],
      imports: [],
      includes: [],
      includeMacros: [],
      importMacros: [],
      topMacros: [],
      macroIncludes: [],
      reads: [],
      unresolvedIncludes: false,
      dynamicIncludes: false,
      dynamicDefinitions: false,
      dynamicExports: false,
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
      // A macro that builds `using`/`import` statements (`Expr(:using, …)`) imports names
      // nothing here can list.
      const generatesImports = (n) =>
        (n.kind === 'call' &&
          identifierName(n.children[0]) === 'Expr' &&
          n.children[1]?.kind === 'quote' &&
          ['using', 'import'].includes(identifierName(n.children[1].children[0]))) ||
        (n.kind === 'quote' && n.children.some((c) => ['using', 'import'].includes(c.kind))) ||
        n.children?.some(generatesImports);
      let macroName = signature;
      while (['call', 'where'].includes(macroName?.kind)) macroName = macroName.children[0];
      if (body && identifierName(macroName) && generatesImports(body))
        m.importMacros.push(`@${identifierName(macroName)}`);
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
      if (s?.kind === 'module' && identifierName(head)) m.topMacros.push(identifierName(head));
      const path =
        node.children.length === 2 && s?.kind === 'module' ? literal(node.children[1], file) : null;
      if (path !== null && !virtual(file))
        m.macroIncludes.push({ name: identifierName(head), path: resolve(dirname(file), path) });
      if (
        identifierName(head) === '@eval' ||
        (head?.kind === '.' && identifierName(head.children.at(-1)) === '@eval')
      ) {
        m.dynamicEvaluation = true;
        const code = node.children.at(-1);
        if (
          code?.kind === '$' ||
          (code?.kind === 'block' && code.children.some((c) => c.kind === '$'))
        ) {
          m.dynamicDefinitions = true;
          if (node.children.length === 3) evalInto.push([m, identifierName(node.children[1])]);
        }
        generatedNames(m, node.children.slice(1), source);
      }
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
      if (['eval', 'include_string'].includes(name)) {
        m.dynamicEvaluation = true;
        generatedNames(m, node.children.slice(1), source);
        // `Core.eval(Sub, ex)` with computed code: `Sub` gets definitions (and exports)
        // nothing here can list.
        const code = node.children.at(-1);
        if (
          name === 'eval' &&
          node.children.length === 3 &&
          !['quote', 'inert'].includes(code?.kind)
        )
          evalInto.push([m, identifierName(node.children[1])]);
      }
      if (name === 'include') {
        // `include` evaluates the file at module scope, also from a `@testset`, `let`, loop
        // or conditional block; only one inside a function body runs at an unknown time.
        let topLevel = false;
        for (let at = s; at; at = at.parent) {
          if (at.kind === 'module') topLevel = true;
          if (['module', 'function'].includes(at.kind)) break;
        }
        const path =
          topLevel && identifierName(head) === 'include' && node.children.length === 2
            ? literal(node.children[1], file)
            : null;
        if (path !== null && !virtual(file))
          m.includes.push({ path: resolve(dirname(file), path), literal: path });
        else {
          m.unresolvedIncludes = true;
          // A computed path, or an include run inside a function or block: its file's
          // globals are unknowable here.
          if (!virtual(file)) m.dynamicIncludes = true;
        }
      }
    }
    // Quotes are data, including their export/include-looking syntax.
    if (['quote', 'inert'].includes(node.kind)) return;
    // Qualified macros (`Reexport.@reexport`) count by their own name.
    const head = node.children[0];
    const macro = head?.kind === '.' ? identifierName(head.children.at(-1)) : identifierName(head);
    const next = node.kind === 'macrocall' ? [...macros, macro] : macros;
    node.children.forEach((n) => walk(n, next));
  }
  const evalInto = [];
  walk(source.ast);
  for (const [m, name] of evalInto) {
    const target = modules.find((t) => t.parent === m.id && t.name === name);
    if (target) {
      target.dynamicDefinitions = true;
      target.dynamicExports = true;
    }
  }
  return modules;
}
// The interpolations that name what generated code defines (`@eval $fname(x) = …`,
// `function $(Symbol(:get_, p))(…)`, `const $name = …`).
function interpolatedNames(node, out = []) {
  if (!node) return out;
  const named = (n) => {
    while (['where', '::', 'curly', 'call'].includes(n?.kind)) n = n.children[0];
    return n?.kind === '$' ? n : null;
  };
  const kinds = ['function', 'macro', 'struct', 'abstract', 'primitive', '=', 'const', 'global'];
  const name = kinds.includes(node.kind) ? named(node.children[0]) : null;
  if (name) out.push(name);
  // `@eval export $(name)`: generated exports.
  if (['export', 'public'].includes(node.kind))
    out.push(...node.children.filter((c) => c.kind === '$'));
  node.children?.forEach((c) => interpolatedNames(c, out));
  return out;
}
// The symbols `$f` takes when an enclosing `for f in (:a, :b)` iterates literal symbols.
function loopSymbols(interpolation, source) {
  const variable = identifierName(interpolation.children[0]);
  if (!variable) return null;
  for (let at = source.getParent(interpolation); at; at = source.getParent(at)) {
    if (at.kind !== 'for') continue;
    const clause = at.children[0];
    for (const pair of clause?.kind === 'iteration' ? clause.children : []) {
      if (identifierName(pair.children[0]) !== variable) continue;
      const values = pair.children[1];
      if (!['tuple', 'vect'].includes(values?.kind)) return null;
      const names = values.children.map((v) =>
        v.kind === 'quote' && v.children.length === 1 ? identifierName(v.children[0]) : null,
      );
      return names.every(Boolean) ? names : null;
    }
  }
  return null;
}
// Generated code under interpolated names: literal-loop names are defined, others unknowable.
function generatedNames(m, args, source) {
  for (const interpolation of args.flatMap((c) => interpolatedNames(c))) {
    const names = loopSymbols(interpolation, source);
    if (names) m.names.push(...names.map((name) => ({ name, kind: 'function' })));
    else m.dynamicDefinitions = true;
  }
}
function fileFacts(file, graph) {
  const version = stamp(file);
  graph.versions.set(file, version);
  if (graph.overlay?.file === file) return graph.overlay.facts;
  const cached = factsCache.get(file);
  if (cached?.version === version && cached.variant === variant) return cached.facts;
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
  factsCache.set(file, { version, variant, facts: result, hash: digest });
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
    importMacros: new Set(),
    topMacros: new Set(),
    exports: new Set(),
    imports: [],
    unknown: new Set(),
    unknownExports: false,
    reads: new Set(),
    unresolvedIncludes: false,
    dynamicIncludes: false,
    dynamicDefinitions: false,
    dynamicExports: false,
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
    m.dynamicIncludes ||= fact.dynamicIncludes;
    m.dynamicDefinitions ||= fact.dynamicDefinitions;
    m.dynamicExports ||= fact.dynamicExports;
    m.dynamicEvaluation ||= fact.dynamicEvaluation;
    fact.includeMacros.forEach((name) => m.includeMacros.add(name));
    fact.importMacros.forEach((name) => m.importMacros.add(name));
    fact.topMacros.forEach((name) => m.topMacros.add(name));
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
// Solved graphs depend on the resolver settings of the analysis that built them.
let variant = '';
// With an environment resolver, a graph's dependencies resolve in the linted file's
// environment (its nearest Project.toml): solved graphs are per environment.
let environmentKey = '';
function resolverActive(settings) {
  const j = settings?.julia;
  if (!j) return false;
  const r = j.resolver;
  return typeof r === 'function' || r === 'pkgjl' || (r == null && Boolean(j.pkgjl));
}
function nearestProject(file) {
  for (const dir of upward(file))
    if (exists(join(dir, 'Project.toml'))) return join(dir, 'Project.toml');
  return null;
}
// The user's macro signatures (`settings.julia.macros`), for dependency and sibling facts.
let currentMacros;
const resolverIds = new WeakMap();
function resolverVariant(settings) {
  const j = settings?.julia;
  if (!j) return '';
  let resolver = j.resolver ?? null;
  if (typeof resolver === 'function') {
    if (!resolverIds.has(resolver)) resolverIds.set(resolver, `fn:${Math.random()}`);
    resolver = resolverIds.get(resolver);
  }
  return JSON.stringify([
    resolver,
    j.pkgjl ?? null,
    j.cacheDir ?? null,
    j.offline ?? null,
    j.macros ?? null,
  ]);
}
function graphFor(entries, overlay) {
  const key = JSON.stringify([
    entries,
    depots(),
    overlay?.file,
    overlay?.hash,
    variant,
    environmentKey,
  ]);
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
    // A package extension's own files: ext/<Ext>/<Ext>.jl includes ext/<Ext>/*.jl.
    const parts = relative(project.dir, file).split(sep);
    if (parts[0] === 'ext' && parts.length > 2)
      candidates.push([join(project.dir, 'ext', parts[1], `${parts[1]}.jl`)]);
  }
  // Harness scripts that include the file from a directory above it: `runtests.jl`,
  // Documenter's `make.jl`/`makedocs.jl`, up to the package or repository root.
  for (const entry of harnessEntries(file, project, track)) candidates.push([entry]);
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
const HARNESS = ['runtests.jl', 'make.jl', 'makedocs.jl'];
function harnessEntries(file, project, track) {
  const entries = [];
  for (const dir of upward(file)) {
    for (const name of HARNESS) {
      const entry = join(dir, name);
      track.set(entry, stamp(entry));
      if (entry !== file && exists(entry)) entries.push(entry);
    }
    if ((project && dir === project.dir) || exists(join(dir, '.git'))) break;
  }
  return entries;
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
    if (at?.dynamicExports) at.unknownExports = true;
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
    const entry = packageEntry(name, state.file, graph.versions, state);
    if (!entry) return null;
    at = loadIndex(entry);
    if (!at) {
      const dependency = graphFor([entry]);
      solve(dependency, state);
      for (const [p, v] of dependency.versions) graph.versions.set(p, v);
      at = dependency.root.children.get(name);
      // JLL packages generate their exports per platform (in JLLWrappers macros), and a
      // module that includes files at run time may export anything from them.
      if (at && (name.endsWith('_jll') || at.dynamicIncludes || at.dynamicDefinitions))
        at.unknownExports = true;
      storeIndex(entry, at);
    }
  }
  for (const part of parts) {
    at = at?.children.get(part);
    // A submodule filled by computed code from outside (`Core.eval(Sub, ex)`).
    if (at?.dynamicExports) at.unknownExports = true;
  }
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
  // A module that runs, at top level, its own macro that generates imports.
  for (const m of modules)
    for (let at = m; at; at = at.parent)
      if ([...m.topMacros].some((name) => at.importMacros.has(name))) m.dynamicDefinitions = true;
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

// A file that no entry's include tree reaches but that runs inside another file's context:
// its includer's imports and definitions are unknown here. Returns the context to assume
// (the package it belongs to, and the harness that most likely runs it), or null.
function fragmentOf(file, ownFacts, track) {
  const project = projectFor(file, track);
  const top = ownFacts.find((m) => m.id === -1);
  const own = (imp) =>
    project && (imp.path === project.name || imp.path.startsWith(`${project.name}.`));
  const inTest =
    project &&
    relative(project.dir, file)
      .split(sep)
      .some((part) => part === 'test' || part === 'tests');
  const harness = harnessEntries(file, project, track)[0] ?? null;
  // A snippet: no imports and no modules of its own, inside an environment (docs examples,
  // scripts run by a harness that `include`s them under a computed path).
  const snippet =
    ownFacts.length === 1 &&
    !top?.imports.length &&
    upward(file).some((dir) => exists(join(dir, 'Project.toml')));
  if (project && file === join(project.dir, 'src', `${project.name}.jl`)) return null;
  if (project) {
    // A package's test file is run by its test harness after `using Package`; a test file
    // that does `using Package` itself is a script of its own. Elsewhere, any import of the
    // package marks a script of its own.
    const script = inTest
      ? top?.imports.some((imp) => own(imp) && imp.wildcard && imp.kind === 'using')
      : top?.imports.some(own);
    // An unreached file under `src/` belongs inside the package module (or is stale): no
    // `using Package` is assumed for it.
    const inSrc = relative(project.dir, file).split(sep)[0] === 'src';
    // `using Package` is only assumed where the file's environment can load the package:
    // the package's own, a test environment, or one that lists it.
    const env = nearestProject(file);
    const loadable =
      inTest || !env || dirname(env) === project.dir || toml(env, track).deps.has(project.name);
    if (!script || snippet) return { project: inSrc || !loadable ? null : project, harness };
    return null;
  }
  // Without a package, only a harness that could run it makes a snippet a fragment.
  return snippet && harness ? { project: null, harness } : null;
}
// The names a fragment's assumed context provides: its harness's top level, and the
// exports of `using Package`.
function fragmentContext(fragment, state) {
  const models = [];
  if (fragment.harness) {
    const harness = graphFor([fragment.harness]);
    solve(harness, { ...state, file: fragment.harness, active: new Set() });
    models.push(harness.root);
  }
  if (fragment.project) {
    const m = moduleModel('Main', null);
    m.imports.push({
      path: fragment.project.name,
      kind: 'using',
      wildcard: true,
      names: [],
      sourceNames: [],
      file: state.file,
    });
    const graph = { root: m, files: new Map(), versions: new Map(), entries: [] };
    solve(graph, { ...state, active: new Set() });
    models.push(m);
  }
  return models;
}
export function applyModuleResolution(manager, source, context = {}) {
  variant = resolverVariant(context.settings);
  environmentKey =
    resolverActive(context.settings) && !virtual(context.physicalFilename)
      ? (nearestProject(resolve(context.physicalFilename)) ?? '')
      : '';
  currentMacros = context.settings?.julia?.macros;
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
  let fragment = false;
  if (!graph) {
    graph = virtual(file) ? graphFor([file], overlay) : graphFor([file]);
    if (!virtual(file) && factsCache.get(file)?.hash !== overlay.hash)
      graph = graphFor([file], overlay);
    occurrences = graph.files.get(file) ?? [];
    fragment = virtual(file) ? null : fragmentOf(file, ownFacts, discovery);
  }
  for (const [p, v] of discovery) graph.versions.set(p, v);
  let environment,
    asked = false;
  const settings = context.settings;
  const state = {
    active: new Set(),
    file,
    // Asked lazily: only a package that isn't installed locally starts the resolver.
    environment:
      virtual(file) || !settings?.julia
        ? null
        : () => {
            if (!asked) environment = environmentFor(file, settings, graph.versions) ?? null;
            asked = true;
            return environment;
          },
    // Only a dependency of the linted file's environment (its nearest Project.toml's
    // `[deps]`, or a transitive one once resolved) is worth resolving.
    dependsOn: (name) => {
      for (const dir of upward(file)) {
        const project = join(dir, 'Project.toml');
        if (!exists(project)) continue;
        return (
          toml(project, graph.versions).deps.has(name) || Boolean(environment?.packages?.[name])
        );
      }
      return false;
    },
  };
  solve(graph, state);
  const assumed = fragment ? fragmentContext(fragment, state) : [];
  manager.moduleResolution = {
    entries: graph.entries,
    files: [...graph.files.keys()],
    scopes: new Map(),
  };
  for (const s of manager.scopes.filter((s) => s.kind === 'module')) {
    const id = s === manager.globalScope ? -1 : s.node.range[0];
    const models = [...new Set(occurrences.filter((o) => o.id === id).map((o) => o.module))];
    // A fragment's assumed context contributes names (and its unknown `using`s), not its
    // own flags or reads: other rules see only the file's own models.
    const context = s === manager.globalScope ? assumed : [];
    s.bareUsing = [...new Set([...models, ...context].flatMap((m) => [...m.unknown]))];
    s.dynamicIncludes = models.some((m) => m.dynamicIncludes);
    s.includeFragment = Boolean(fragment) && s === manager.globalScope;
    s.dynamicDefinitions = models.some((m) => m.dynamicDefinitions);
    manager.moduleResolution.scopes.set(s, models);
    for (const m of [...models, ...context]) {
      if (s === manager.globalScope && m.parent) s.bare = m.bare;
      for (const [name, kind] of m.names) {
        if (kind === 'macro-binding') {
          // Declared by a macro somewhere in the module: suppresses reports only.
          s.macroBindings ??= new Map();
          if (!s.bindings.has(name) && !s.macroBindings.has(name))
            s.macroBindings.set(name, {
              name,
              kind,
              scope: s,
              definitions: [],
              references: [],
              writes: [],
              constant: false,
              macro: true,
            });
          continue;
        }
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
  // `@eval M code`: the names `M` defines (null when they can't be listed).
  manager.moduleResolution.evalNames = new Map();
  for (const [code, { path, scope }] of manager.evalTargets ?? []) {
    const id = scope === manager.globalScope ? -1 : scope.node.range[0];
    const from = occurrences.find((o) => o.id === id)?.module ?? graph.root;
    // A submodule of the enclosing module (or of an outer one) by that name comes first.
    let local = null;
    if (!path.includes('.'))
      for (let at = from; at && !local; at = at.parent) local = at.children.get(path) ?? null;
    const target = local ? { module: local } : findModule(path, from, graph, state);
    const m = target?.module;
    const listed =
      m &&
      !m.indexed &&
      !m.unknownExports &&
      !m.unknown.size &&
      !m.dynamicDefinitions &&
      !m.dynamicIncludes &&
      !m.unresolvedIncludes;
    manager.moduleResolution.evalNames.set(code, {
      path,
      names: listed
        ? new Set([...m.names.keys(), ...m.exports, ...m.children.keys(), m.name])
        : null,
    });
  }
}
