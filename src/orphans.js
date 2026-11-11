// Which files of a package can run: the files its entry points reach through `include`.
// Syntactic only: never loads a package or executes Julia.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, sep, basename } from 'node:path';
import { parseJulia } from './parser/syntax-tree.js';
import { isInfixCall } from './parser/flags.js';
import { identifierName } from './scope.js';

// Files meant to be run on their own (relative to the package directory).
export const DEFAULT_SCRIPTS = [
  '*.jl',
  'docs/**',
  'benchmark/**',
  'benchmarks/**',
  'bench/**',
  'perf/**',
  'examples/**',
  'scripts/**',
  'tools/**',
  'contrib/**',
  'gen/**',
  'bin/**',
  'deps/build.jl',
];
// Functions that run (or load) a file given its path.
const INCLUDERS = new Set(['include', 'includet', 'evalfile', 'include_dependency']);

const mtime = (path) => {
  try {
    const s = statSync(path);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return null;
  }
};
// Path joiners: `joinpath(a, b)`, `normpath(a, b)`, `abspath(a, b)`, `realpath(a)`.
const JOINERS = new Set(['joinpath', 'normpath', 'abspath', 'realpath']);
// Functions whose string arguments are directories: `push!(LOAD_PATH, "fixtures")`, `cd("x")`.
const DIRECTORY_CALLS = new Set(['push!', 'pushfirst!', 'cd', 'readdir', 'walkdir']);
const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};
const posix = (path) => path.split(sep).join('/');
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

// `**` any depth, `*` and `?` within one path segment.
export function globRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        i++;
        out += '(?:.*/)?';
      } else out += '.*';
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += escape(c);
  }
  return new RegExp(`^${out}$`, 'u');
}

// The nearest named Project.toml: { dir, name, extensions }.
const projects = new Map();
export function packageFor(file) {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const path = join(dir, 'Project.toml'),
      version = mtime(path);
    let cached = projects.get(path);
    if (cached?.version !== version) {
      cached = { version, value: version ? readProject(path, dir) : null };
      projects.set(path, cached);
    }
    if (cached.value?.name) return cached.value;
    if (dirname(dir) === dir) return null;
  }
}
function readProject(path, dir) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  const result = { dir, name: null, extensions: [] };
  let table = '';
  for (const line of text.split(/\r?\n/u)) {
    const header = line.match(/^\s*\[\s*([^\]]+?)\s*\]/u);
    if (header) {
      table = header[1];
      continue;
    }
    const key = line.match(/^\s*(?:"([^"]+)"|([\w-]+))\s*=\s*(.*)$/u);
    if (!key) continue;
    if (!table && key[2] === 'name') result.name = key[3].match(/^"([^"]*)"/u)?.[1] ?? null;
    if (table === 'extensions') result.extensions.push(key[1] ?? key[2]);
  }
  return result;
}

// A path expression as literal pieces (strings) and unknown pieces (null).
function pathPieces(node, file, env, depth = 0) {
  if (!node || depth > 8) return [null];
  const c = node.children ?? [];
  switch (node.kind) {
    case 'string':
      return c.flatMap((p) =>
        p.kind === 'String' && !p.value.includes('\\')
          ? [p.value]
          : pathPieces(p.kind === 'parens' ? p.children[0] : p, file, env, depth + 1),
      );
    case 'parens':
      return c.length === 1 ? pathPieces(c[0], file, env, depth + 1) : [null];
    case 'macrocall': {
      const name = identifierName(c[0]);
      if (c.length === 1 && name === '@__DIR__') return [dirname(file)];
      if (c.length === 1 && name === '@__FILE__') return [file];
      return [null];
    }
    case 'Identifier':
      return env.get(node.value)?.(depth + 1) ?? [null];
    case 'call': {
      if (isInfixCall(node))
        return identifierName(c[1]) === '*'
          ? [c[0], ...c.slice(2)].flatMap((p) => pathPieces(p, file, env, depth + 1))
          : [null];
      const head = c[0],
        name =
          identifierName(head) ??
          (head?.kind === '.' ? identifierName(head.children.at(-1)) : null),
        args = c.slice(1).filter((a) => a.kind !== 'parameters');
      if (JOINERS.has(name) && args.length)
        return args.flatMap((a, i) => [
          ...(i ? ['/'] : []),
          ...pathPieces(a, file, env, depth + 1),
        ]);
      if (name === 'string') return args.flatMap((a) => pathPieces(a, file, env, depth + 1));
      if (name === 'dirname' && args.length === 1) {
        const inner = pathPieces(args[0], file, env, depth + 1);
        return inner.every((p) => p !== null)
          ? [dirname(resolve(dirname(file), inner.join('')))]
          : [null];
      }
      if (name === 'pkgdir') {
        const p = packageFor(file);
        return p ? [p.dir] : [null];
      }
      return [null];
    }
    default:
      return [null];
  }
}
// What a path expression can name: one file, or the files a pattern matches.
function matcher(pieces, file) {
  const merged = [];
  for (const p of pieces)
    if (typeof p === 'string' && typeof merged.at(-1) === 'string') merged[merged.length - 1] += p;
    else merged.push(p);
  if (merged.every((p) => p !== null)) return { path: resolve(dirname(file), merged.join('')) };
  // The pattern starts in the including file's directory (`include`'s own rule; `@__DIR__`
  // paths are absolute) joined with the pattern's literal leading directories (`../lib/`).
  const head = typeof merged[0] === 'string' ? posix(merged.shift()) : '';
  const cut = head.lastIndexOf('/');
  const dir = posix(resolve(dirname(file), head.slice(0, cut + 1) || '.')).replace(/\/$/u, '');
  // More than two unknown spans would make the regular expression backtrack badly on long
  // names; such a path could name any file below its literal directory.
  if (merged.filter((p) => p === null).length > 2) return { pattern: `^${escape(dir)}/.*$` };
  const body = [head.slice(cut + 1), ...merged]
    .map((p) => (p === null ? '.*' : escape(posix(p))))
    .join('')
    .replace(/\/+/gu, '/')
    .replace(/^\//u, '');
  return { pattern: `^${escape(dir)}/${body}$` };
}

// Per file: the files it names to `include` (exact paths and patterns), and whether it
// couldn't be read.
const reachCache = new Map();
export function includesOf(file) {
  const version = mtime(file);
  const cached = reachCache.get(file);
  if (cached?.version === version) return cached.value;
  const value = {
    paths: new Set(),
    patterns: new Set(),
    // The patterns of computed `include` calls alone (not of paths merely named).
    computed: new Set(),
    unknown: false,
    listed: [],
    unknownInclude: false,
    valueInclude: false,
    live: false,
  };
  let parsed;
  try {
    parsed = parseJulia(readFileSync(file, 'utf8'));
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.diagnostics.some((d) => d.level === 1)) value.unknown = true;
  else collect(parsed.ast ?? parsed.tree, file, value);
  settle(value, file);
  reachCache.set(file, { version, value });
  return value;
}
// The `$(…)` parts of a command literal.
function interpolations(text) {
  const parts = [];
  for (let i = text.indexOf('$('); i >= 0; i = text.indexOf('$(', i + 1)) {
    let depth = 0;
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '(') depth++;
      else if (text[j] === ')' && --depth === 0) {
        parts.push(text.slice(i + 2, j));
        break;
      }
    }
  }
  return parts;
}
function collect(root, file, out, outer = null) {
  // Names assigned once in the file (`const TESTDIR = joinpath(@__DIR__, "x")`), and loop
  // variables over `readdir(dir; join = true)`: their path pieces.
  const assigned = new Map(),
    env = new Map(outer ?? []);
  // `quoted`: inside a quote or a macro definition, code that may never run as written.
  const visit = (node, fn, quoted = false) => {
    fn(node, quoted);
    const inner = quoted || node.kind === 'quote' || node.kind === 'macro';
    for (const child of node.children ?? []) visit(child, fn, inner);
  };
  visit(root, (node) => {
    let target = null,
      value = null;
    if (node.kind === '=' && node.children.length === 2) [target, value] = node.children;
    if (node.kind === 'const' && node.children[0]?.kind === '=')
      [target, value] = node.children[0].children;
    if (target?.kind === 'Identifier') {
      if (!assigned.has(target.value)) assigned.set(target.value, []);
      assigned.get(target.value).push({ value, loop: false });
    }
    if (node.kind === 'iteration')
      for (const spec of node.children)
        if (['in', '=', '∈'].includes(spec.kind) && spec.children[0]?.kind === 'Identifier') {
          const name = spec.children[0].value;
          if (!assigned.has(name)) assigned.set(name, []);
          assigned.get(name).push({ value: spec.children[1], loop: true });
        }
  });
  for (const [name, values] of assigned) {
    if (values.length !== 1 || outer) continue;
    const [{ value, loop }] = values;
    env.set(name, (depth) => {
      if (!loop) return pathPieces(value, file, env, depth);
      // `for f in readdir(dir; join = true)`: a file of `dir`.
      const head = identifierName(value?.children?.[0]);
      const join = value?.children?.some(
        (p) =>
          p.kind === 'parameters' &&
          p.children.some((k) => identifierName(k.children?.[0]) === 'join'),
      );
      if (
        value?.kind === 'call' &&
        head === 'readdir' &&
        join &&
        value.children[1]?.kind !== 'parameters'
      )
        return [...pathPieces(value.children[1], file, env, depth), '/', null];
      return [null];
    });
  }
  const directory = (text) => {
    const path = resolve(dirname(file), text);
    if (isDirectory(path) && !posix(dirname(file) + sep).startsWith(posix(path + sep)))
      out.patterns.add(`^${escape(posix(path))}/.*$`);
  };
  const add = (pieces) => {
    const m = matcher(pieces, file);
    if (m.path) out.paths.add(m.path);
    else out.patterns.add(m.pattern);
  };
  visit(root, (node, quoted) => {
    const c = node.children ?? [];
    if (node.kind === 'call' || node.kind === 'dotcall') {
      const head = c[0],
        name =
          identifierName(head) ??
          (head?.kind === '.' ? identifierName(head.children.at(-1)) : null);
      if (INCLUDERS.has(name) && !isInfixCall(node)) {
        const args = c.slice(1).filter((a) => a.kind !== 'parameters');
        // `include(M, path)`: the path is the last argument. `include.(paths)` maps over paths.
        const path = args.at(-1);
        const pieces = path && node.kind === 'call' ? pathPieces(path, file, env) : null;
        if (pieces?.some((p) => p !== null)) {
          const m = matcher(pieces, file);
          if (m.pattern && !quoted) out.computed.add(m.pattern);
          add(pieces);
        } else if (pieces) {
          out.unknownInclude = true;
          if (!quoted) out.live = true;
        } else if (path) {
          out.valueInclude = true;
          if (!quoted) out.live = true;
        }
      }
      // `readdir(dir)`, `walkdir(dir)`: the directories a computed include may list.
      if (['readdir', 'walkdir'].includes(name) && node.kind === 'call') {
        const dir = c.slice(1).find((a) => a.kind !== 'parameters');
        out.listed.push(dir ? [...pathPieces(dir, file, env), '/', null] : [null]);
      }
    }
    // A `.jl` path named anywhere (a list of test files, a script run in a subprocess), or a
    // directory named as a path (a fixtures directory, a `LOAD_PATH` entry): its files can
    // run. A bare word naming a directory (`@testset "integration"`) is not a path.
    const callee = node.kind === 'call' ? identifierName(c[0]) : null;
    if (node.kind === 'string' || JOINERS.has(callee)) {
      const pieces = pathPieces(node, file, env);
      if (pieces.every((p) => p !== null)) {
        const text = pieces.join('');
        if (text.endsWith('.jl')) out.paths.add(resolve(dirname(file), text));
        else if (JOINERS.has(callee) || /[\\/]/u.test(text)) directory(text);
      } else if (typeof pieces.at(-1) === 'string' && pieces.at(-1).endsWith('.jl')) add(pieces);
    }
    if (DIRECTORY_CALLS.has(callee))
      for (const arg of c.slice(1)) {
        const pieces = arg.kind === 'string' ? pathPieces(arg, file, env) : [null];
        if (pieces.every((p) => p !== null)) directory(pieces.join(''));
      }
    // Command literals aren't parsed into interpolations: their `$(…)` parts and `.jl` words.
    if (node.kind === 'CmdString') {
      const text = String(node.value);
      for (const code of interpolations(text)) {
        let parsed;
        try {
          parsed = parseJulia(code);
        } catch {
          continue;
        }
        if (parsed.diagnostics.some((d) => d.level === 1)) continue;
        collect(parsed.ast ?? parsed.tree, file, out, env);
      }
      for (const [word] of text.replace(/\$\([^)]*\)/gu, ' ').matchAll(/[^\s"'`$()]+\.jl\b/gu))
        out.paths.add(resolve(dirname(file), word));
    }
    // `include` passed as a value (`map(include, files)`, `foreach(include, …)`).
    if ((node.kind === 'call' || node.kind === 'dotcall') && !isInfixCall(node))
      for (const arg of c.slice(1))
        if (arg.kind === 'Identifier' && INCLUDERS.has(arg.value)) {
          out.valueInclude = true;
          if (!quoted) out.live = true;
        }
  });
}
// An include of a computed path (`include(f)`, `foreach(include, files)`) reaches the
// directories the file lists (`readdir`, `walkdir`); without one, `include(f)` reaches any file
// below the including file's directory. Literal paths the collection is built from are
// mentions of their own.
function settle(out, file) {
  if (out.unknownInclude || out.valueInclude) {
    const patterns = out.listed.length
      ? out.listed.map((pieces) => matcher(pieces, file).pattern).filter(Boolean)
      : out.unknownInclude
        ? [matcher([null], file).pattern]
        : [];
    for (const p of patterns) {
      out.patterns.add(p);
      if (out.live) out.computed.add(p);
    }
  }
  delete out.listed;
  delete out.unknownInclude;
  delete out.valueInclude;
  delete out.live;
  return out;
}

// A file run without being included: a shebang script, a file of test items (discovered by
// TestItemRunner or ReTestItems), a Pluto notebook, a script that reads its command line or
// exits the process, one whose comments say how to run it (`julia --project test/x.jl`).
const RUN_ON_ITS_OWN =
  /^#!|^\s*@test(?:item|module|snippet|setup)\b|^### A Pluto\.jl notebook ###|\bARGS\b|^\s*exit\(/mu;
const ownCache = new Map();
function runsOnItsOwn(file, text) {
  if (text !== undefined) return ownScript(file, text);
  const version = mtime(file);
  const cached = ownCache.get(file);
  if (cached?.version === version) return cached.value;
  let value = false;
  try {
    value = ownScript(file, readFileSync(file, 'utf8'));
  } catch {
    /* unreadable */
  }
  ownCache.set(file, { version, value });
  return value;
}
function ownScript(file, text) {
  if (RUN_ON_ITS_OWN.test(text)) return true;
  const name = escape(basename(file));
  return new RegExp(`^\\s*#.*\\bjulia\\b.*(?:^|[\\s/])${name}\\b`, 'mu').test(text);
}
// Shell scripts and build files that may run a Julia file by its path.
const RUNNER = /^(?:.*\.(?:sh|bash|ps1|cmd|bat|mk|ya?ml)|Makefile|justfile|Justfile)$/u;
// The CI configuration of the repository around `dir`.
function ciFiles(dir) {
  let root = null;
  for (let at = dir; ; at = dirname(at)) {
    if (mtime(join(at, '.git'))) {
      root = at;
      break;
    }
    if (dirname(at) === at) break;
  }
  if (!root) return { root: dir, files: [] };
  const files = [];
  for (const sub of ['.github/workflows', '.buildkite', '.ci', '.gitlab'])
    try {
      for (const e of readdirSync(join(root, sub), { withFileTypes: true }))
        if (e.isFile()) files.push(join(root, sub, e.name));
    } catch {
      /* no such directory */
    }
  for (const name of ['.gitlab-ci.yml', '.travis.yml', 'appveyor.yml', 'Makefile'])
    if (mtime(join(root, name))) files.push(join(root, name));
  return { root, files };
}
// The `.jl` files of a package directory, without nested packages or hidden directories.
function packageFiles(
  dir,
  root = dir,
  out = { files: [], runners: [], nested: [], dirs: new Map() },
) {
  out.dirs.set(dir, mtime(dir));
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      if (packageFor(join(path, 'x.jl'))?.dir === path) {
        out.nested.push(packageFor(join(path, 'x.jl')));
        continue;
      }
      packageFiles(path, root, out);
    } else if (e.name.endsWith('.jl')) out.files.push(path);
    else if (RUNNER.test(e.name)) out.runners.push(path);
  }
  return out;
}

// `text` names the relative path `path` as a whole word.
const mentions = (text, path) => {
  let at = text.indexOf(path);
  while (at >= 0) {
    const before = text[at - 1],
      after = text[at + path.length];
    if ((!before || !/[\w.-]/u.test(before)) && (!after || !/[\w-]/u.test(after))) return true;
    at = text.indexOf(path, at + 1);
  }
  return false;
};
// The files of `pkg` its entry points reach, cached until a visited file or directory changes.
const packageCache = new Map();
export function reachable(pkg, options) {
  const key = JSON.stringify([pkg.dir, options.entryPoints, options.scripts]);
  const cached = packageCache.get(key);
  if (
    cached &&
    [...cached.versions].every(([p, v]) => mtime(p) === v) &&
    [...cached.listing.dirs].every(([p, v]) => mtime(p) === v)
  )
    return cached.value;
  const listing = packageFiles(pkg.dir);
  const rel = (f) => posix(relative(pkg.dir, f));
  const entriesOf = (p) =>
    [
      join(p.dir, 'src', `${p.name}.jl`),
      join(p.dir, 'test', 'runtests.jl'),
      ...p.extensions.flatMap((ext) => [
        join(p.dir, 'ext', `${ext}.jl`),
        join(p.dir, 'ext', ext, `${ext}.jl`),
      ]),
    ].filter((f) => mtime(f));
  const entryRegs = options.entryPoints.map(globRegExp),
    scriptRegs = options.scripts.map(globRegExp);
  const entries = entriesOf(pkg);
  const configured = listing.files.filter((f) => entryRegs.some((r) => r.test(rel(f))));
  // Every `runtests.jl` is a test harness (a sub-suite run on its own: `test/trim/runtests.jl`).
  const harnesses = listing.files.filter((f) => basename(f) === 'runtests.jl');
  const scripts = listing.files.filter(
    (f) => scriptRegs.some((r) => r.test(rel(f))) || runsOnItsOwn(f),
  );
  const versions = new Map(),
    reached = new Set(),
    // A package below this one (a monorepo's `lib/Sub`) may include this one's files
    // (`include("../../../test/shared/common.jl")`).
    queue = [
      ...entries,
      ...configured,
      ...harnesses,
      ...scripts,
      ...listing.nested.flatMap(entriesOf),
    ],
    patterns = [];
  // Its `[extensions]` decide the entry points.
  const project = join(pkg.dir, 'Project.toml');
  versions.set(project, mtime(project));
  // Files that CI or a shell script runs by path (`julia --project test/quality.jl`).
  const ci = ciFiles(pkg.dir),
    run = [];
  for (const runner of [...new Set([...ci.files, ...listing.runners])]) {
    versions.set(runner, mtime(runner));
    try {
      const text = readFileSync(runner, 'utf8');
      for (const f of listing.files) {
        // The path from the repository root, any tail of it with a directory
        // (`test/quality.jl`, run from the package directory), or the bare name in a script
        // beside the file.
        const parts = posix(relative(ci.root, f)).split('/');
        const names = parts.slice(0, -1).map((_, i) => parts.slice(i).join('/'));
        if (dirname(runner) === dirname(f)) names.push(parts.at(-1));
        if (names.some((n) => mentions(text, n))) run.push(f);
      }
    } catch {
      /* unreadable */
    }
  }
  queue.push(...run);
  const visit = (file) => {
    if (reached.has(file)) return;
    reached.add(file);
    versions.set(file, mtime(file));
    if (!versions.get(file)) return;
    const facts = includesOf(file);
    if (facts.unknown) patterns.push(new RegExp(`^${escape(posix(dirname(file)))}/.*$`, 'u'));
    for (const p of facts.paths) queue.push(p);
    for (const p of facts.patterns) patterns.push(new RegExp(p, 'u'));
  };
  for (;;) {
    while (queue.length) visit(queue.pop());
    const more = listing.files.filter(
      (f) => !reached.has(f) && patterns.some((r) => r.test(posix(f))),
    );
    if (!more.length) break;
    queue.push(...more);
  }
  const value = { entries, configured: configured.length > 0, reached };
  packageCache.set(key, { versions, listing, value });
  if (packageCache.size > 64) packageCache.delete(packageCache.keys().next().value);
  return value;
}

// Why `file` never runs, or null: the package and entry points that don't reach it.
export function orphan(file, options = {}, text = '') {
  const o = {
    entryPoints: options.entryPoints ?? [],
    scripts: options.scripts ?? DEFAULT_SCRIPTS,
  };
  const pkg = packageFor(file);
  if (!pkg) return null;
  const rel = posix(relative(pkg.dir, file));
  // Hidden directories hold tool configuration (`.ci/`, `.pkg/` hooks Pkg runs).
  if (rel.split('/').some((part) => part.startsWith('.'))) return null;
  if (runsOnItsOwn(file, text)) return null;
  // A file with an environment of its own (a nested Project.toml other than the package's test
  // environment) is run in that environment, not by the package: `julia --project=tools x.jl`.
  for (let dir = dirname(file); dir !== pkg.dir && dir.startsWith(pkg.dir); dir = dirname(dir)) {
    const env = posix(relative(pkg.dir, dir));
    if (env !== 'test' && env !== 'tests' && mtime(join(dir, 'Project.toml'))) return null;
  }
  // A package inside another package's tests is a fixture its tests copy or load.
  const outer = packageFor(pkg.dir);
  if (
    outer &&
    posix(relative(outer.dir, pkg.dir))
      .split('/')
      .some((p) => p === 'test' || p === 'tests')
  )
    return null;
  if ([...o.entryPoints, ...o.scripts].some((g) => globRegExp(g).test(rel))) return null;
  // A test harness that names no file (`runtests(Pkg, ARGS)` of a test runner that discovers
  // the files itself): reachability under `test/` can't be measured.
  const harness = join(pkg.dir, 'test', 'runtests.jl');
  if (rel.startsWith('test/') && mtime(harness)) {
    const named = includesOf(harness);
    if (!named.unknown && !named.paths.size && !named.patterns.size) return null;
  }
  const result = reachable(pkg, o);
  // No entry point found: nothing to measure reachability against.
  if (!result.entries.length && !result.configured) return null;
  if (result.reached.has(file)) return null;
  // The entry points named in the message: the package module, extensions, tests, and any
  // configured ones.
  const names = result.entries.map((e) => posix(relative(pkg.dir, e)));
  const entries = [
    ...names.filter((n) => n.startsWith('src/')),
    ...(names.some((n) => n.startsWith('ext/')) ? ['ext/'] : []),
    ...names.filter((n) => n.startsWith('test/')),
    ...(result.configured ? ['entryPoints'] : []),
  ];
  return { pkg, entries };
}
