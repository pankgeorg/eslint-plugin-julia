import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { resolveEnvironment } from '../../src/resolver/index.js';
import { manifestNames, rewritePaths } from '../../src/resolver/toml.js';

const uuid = '11111111-2222-3333-4444-555555555555';
const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
function fixture(t, mode = 'ok') {
  const dir = mkdtempSync(join(sourceRoot, 'tests/.tmp-resolver-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const backend = join(dir, 'backend'),
    projectFile = join(dir, 'Project.toml');
  mkdirSync(join(backend, 'dist'), { recursive: true });
  writeFileSync(join(backend, 'package.json'), '{"type":"module"}');
  writeFileSync(projectFile, `[deps]\nFoo = "${uuid}"\n`);
  writeFileSync(
    join(backend, 'dist/index.js'),
    `
    import { join } from 'node:path';
    export function configurePkgWasm({dir}) { if (dir !== 'expected') throw Error('wrong Wasm dir'); }
    export const pkgWasmAvailable = () => ${mode !== 'unavailable'};
    export const locate = (target) => ({ '${uuid}': join(target.env.JULIA_DEPOT_PATH, 'packages/Foo/AbCdE/src/Foo.jl'), stdlib: null });
  `,
  );
  writeFileSync(
    join(backend, 'dist/withjuliapkg.js'),
    `
    import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
    import { join, dirname } from 'node:path';
    export async function juliaPkg(target, operation, options) {
      const depot = target.env.JULIA_DEPOT_PATH;
      appendFileSync(join(depot, 'calls'), 'call\\n');
      if (target.env.WASMHOST_PLATFORM !== 'arch=wasm32;os=wasi' || target.env.JULIA_PKG_PRECOMPILE_AUTO !== '0') throw Error('bad environment');
      if (operation.kind !== 'instantiate' || options.project !== target.cwd || options.requestId !== 'eslint') throw Error('bad request');
      options.onOutput('output');
      if ('${mode}' === 'slow') await new Promise(r => setTimeout(r, 5000));
      if ('${mode}' === 'delay') await new Promise(r => setTimeout(r, 200));
      if ('${mode}' === 'fail') return {status: 'error', report: {status: false, error: 'fake Pkg failure'}};
      if ('${mode}' === 'throw') throw Error('fake thrown failure');
      if ('${mode}' === 'retry' && existsSync(join(target.cwd, 'Manifest.toml'))) {
        writeFileSync(join(depot, 'original-manifest'), readFileSync(join(target.cwd, 'Manifest.toml')));
        return {status: 'ok', report: {status: false, error: 'retry without manifest'}};
      }
      const files = {
        'packages/CACHEDIR.TAG': 'cache marker',
        'packages/Foo/AbCdE/src/Foo.jl': 'module Foo; end',
        'packages/Foo/AbCdE/src/nested/child.jl': 'x=1',
        'packages/Foo/AbCdE/src/data.bin': 'binary',
        'packages/Foo/AbCdE/test/x.jl': 'test',
        'packages/Foo/AbCdE/deps/build.log': 'build',
        'packages/Foo/AbCdE/docs/index.md': 'docs',
        'packages/Foo/AbCdE/Project.toml': 'name="Foo"',
        'packages/Foo/AbCdE/JuliaProject.toml': 'name="Foo"',
        'artifacts/hash/lib.so': 'artifact', 'clones/id/file': 'clone',
        'compiled/file': 'compiled', 'logs/file': 'logs', 'scratchspaces/file': 'scratch',
        'registries/Registry.toml': 'registry',
      };
      for (const [file, text] of Object.entries(files)) {
        const path = join(depot, file); mkdirSync(dirname(path), {recursive:true}); writeFileSync(path, text);
      }
      if ('${mode}' === 'partial') return {status: 'error', report: {status: false, error: 'failed after downloading'}};
      writeFileSync(join(target.cwd, 'Manifest.toml'), '[[deps.Foo]]\\ndeps = ["Bar"]\\nuuid = "${uuid}"\\n');
      return {status: 'ok', report: {status: true}};
    }
  `,
  );
  const request = { projectFile, manifestFile: null };
  const settings = {
    julia: {
      pkgjl: backend,
      pkgWasm: 'expected',
      cacheDir: join(dir, 'cache'),
      resolverTimeout: 10,
    },
  };
  return { dir, backend, request, settings, run: () => resolveEnvironment(request, settings) };
}
function files(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((item) => {
      // Forward slashes on every platform, for comparison.
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      return item.isDirectory() ? files(join(dir, item.name), path) : [path];
    })
    .sort();
}
function external(f) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {resolveEnvironment} from './src/resolver/index.js';
    console.log(JSON.stringify(resolveEnvironment(${JSON.stringify(f.request)}, ${JSON.stringify(f.settings)})));
  `,
    ],
    { cwd: sourceRoot, encoding: 'utf8' },
  );
}

test('resolver: stable key, source-only depot, and warm cache without backend', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.ok(result);
  assert.equal(result.cached, false);
  assert.equal(
    result.key,
    createHash('sha256')
      .update('1.13' + readFileSync(f.request.projectFile, 'utf8'))
      .digest('hex'),
  );
  assert.equal(result.envDir, join(f.settings.julia.cacheDir, 'envs', result.key.slice(0, 16)));
  assert.equal(result.packages.Foo.uuid, uuid);
  assert.deepEqual(files(dirname(dirname(result.packages.Foo.entry))), [
    'JuliaProject.toml',
    'Project.toml',
    'src/Foo.jl',
    'src/nested/child.jl',
  ]);
  assert.ok(!existsSync(join(f.settings.julia.cacheDir, 'depot/packages/CACHEDIR.TAG')));
  const data = JSON.parse(readFileSync(join(result.envDir, 'env.json')));
  assert.equal(data.stats.packages, 1);
  assert.equal(data.stats.artifactsRemoved, 1);
  assert.ok(data.stats.removedBytes > 0);
  assert.ok(data.stats.sourceBytes > 0);
  for (const name of ['artifacts', 'clones', 'compiled', 'logs', 'scratchspaces'])
    assert.ok(!existsSync(join(f.settings.julia.cacheDir, 'depot', name)));
  assert.ok(existsSync(join(f.settings.julia.cacheDir, 'depot/registries/Registry.toml')));
  rmSync(f.backend, { recursive: true });
  assert.equal(f.run().cached, true);
  const warm = external(f);
  assert.equal(warm.status, 0, warm.stderr);
  assert.equal(JSON.parse(warm.stdout).cached, true);
  assert.equal(readFileSync(join(f.settings.julia.cacheDir, 'depot/calls'), 'utf8'), 'call\n');
  f.request.packageName = 'Foo';
  assert.deepEqual(f.run().packages, {});
});

test('resolver: rewrites source tables and inline paths, keeps other content', (t) => {
  const f = fixture(t, 'retry');
  const original = `name = 'Own'\nuuid = 'own-uuid'\n# path = "ignored"\n[extras]\npath = 'unrelated'\n[sources]\nFoo = { path = '../Foo', rev = 'main' }\n    [sources.Bar]\n"path" = "./Bar" # keep comment\n`;
  writeFileSync(f.request.projectFile, original);
  const rewritten = original
    .replace("'../Foo'", JSON.stringify(resolve(f.dir, '../Foo')))
    .replace('"./Bar"', JSON.stringify(join(f.dir, 'Bar')));
  assert.equal(rewritePaths(original, f.request.projectFile), rewritten);
  const absolute = join(f.dir, 'absolute');
  assert.equal(
    rewritePaths(`[sources]\nFoo = {path = '${absolute}'}`, f.request.projectFile),
    `[sources]\nFoo = {path = '${absolute}'}`,
  );
  f.request.manifestFile = join(f.dir, 'Manifest.toml');
  const manifest = `[[deps.Foo]]\nuuid = '${uuid}'\npath = '../Foo'\n`;
  writeFileSync(f.request.manifestFile, manifest);
  const result = f.run();
  assert.ok(result);
  assert.equal(readFileSync(join(result.envDir, 'project/Project.toml'), 'utf8'), rewritten);
  assert.equal(
    readFileSync(join(f.settings.julia.cacheDir, 'depot/original-manifest'), 'utf8'),
    manifest.replace("'../Foo'", JSON.stringify(resolve(f.dir, '../Foo'))),
  );
  assert.equal(readFileSync(f.request.projectFile, 'utf8'), original);
  assert.equal(readFileSync(f.request.manifestFile, 'utf8'), manifest);
  assert.equal(
    readFileSync(join(f.settings.julia.cacheDir, 'depot/calls'), 'utf8'),
    'call\ncall\n',
  );
  assert.equal(manifestNames(`[["Foo"]]\nuuid = '${uuid}'\n`).get(uuid), 'Foo');
});

test('resolver: failures are cached on disk for an hour and forever in process', (t) => {
  const f = fixture(t, 'fail');
  assert.equal(f.run(), null);
  const envDir = join(
    f.settings.julia.cacheDir,
    'envs',
    readdirSync(join(f.settings.julia.cacheDir, 'envs'))[0],
  );
  const failedFile = join(envDir, 'failed.json');
  const failure = JSON.parse(readFileSync(failedFile));
  assert.match(failure.error, /fake Pkg failure/u);
  assert.ok(Date.now() - failure.at < 10000);
  assert.equal(JSON.parse(external(f).stdout), null);
  assert.equal(readFileSync(join(f.settings.julia.cacheDir, 'depot/calls'), 'utf8'), 'call\n');
  writeFileSync(failedFile, JSON.stringify({ ...failure, at: 0 }));
  assert.equal(f.run(), null);
  assert.equal(JSON.parse(external(f).stdout), null);
  assert.equal(
    readFileSync(join(f.settings.julia.cacheDir, 'depot/calls'), 'utf8'),
    'call\ncall\n',
  );
});

test('resolver: a failed instantiate leaves a source-only depot', (t) => {
  const f = fixture(t, 'partial');
  assert.equal(f.run(), null);
  const depot = join(f.settings.julia.cacheDir, 'depot');
  assert.deepEqual(files(join(depot, 'packages')), [
    'Foo/AbCdE/JuliaProject.toml',
    'Foo/AbCdE/Project.toml',
    'Foo/AbCdE/src/Foo.jl',
    'Foo/AbCdE/src/nested/child.jl',
  ]);
  for (const name of ['artifacts', 'clones', 'compiled', 'logs', 'scratchspaces'])
    assert.equal(existsSync(join(depot, name)), false, name);
});
test('resolver: missing backend, unavailable runtime, exceptions and timeout return null', (t) => {
  for (const mode of ['missing', 'unavailable', 'throw', 'slow']) {
    const f = fixture(t, mode);
    if (mode === 'missing') rmSync(f.backend, { recursive: true });
    if (mode === 'slow') f.settings.julia.resolverTimeout = 0.2;
    assert.equal(f.run(), null, mode);
    const envs = join(f.settings.julia.cacheDir, 'envs');
    assert.ok(existsSync(join(envs, readdirSync(envs)[0], 'failed.json')));
  }
});

test('resolver: custom sync functions, none, default and offline', (t) => {
  const f = fixture(t);
  let seen;
  const custom = {
    julia: {
      resolver: (request) => {
        seen = request;
        return { packages: { Foo: '/source/Foo.jl', Bar: { uuid, entry: '/source/Bar.jl' } } };
      },
    },
  };
  assert.deepEqual(resolveEnvironment(f.request, custom).packages, {
    Foo: { entry: '/source/Foo.jl' },
    Bar: { uuid, entry: '/source/Bar.jl' },
  });
  assert.equal(seen, f.request);
  for (const resolver of [
    'none',
    () => null,
    () => {
      throw Error('oops');
    },
    async () => null,
  ])
    assert.equal(resolveEnvironment(f.request, { julia: { resolver } }), null);
  assert.equal(resolveEnvironment(f.request), null);
  f.settings.julia.offline = true;
  assert.equal(f.run(), null);
  assert.ok(!existsSync(f.settings.julia.cacheDir));
  f.settings.julia.offline = false;
  const result = f.run();
  f.settings.julia.offline = true;
  rmSync(f.backend, { recursive: true });
  assert.equal(f.run().cached, true);
  rmSync(result.packages.Foo.entry);
  assert.equal(f.run(), null);
  f.settings.julia.offline = false;
  assert.equal(f.run(), null);
});

test('resolver: stale locks are replaced', (t) => {
  const f = fixture(t);
  const key = createHash('sha256')
    .update('1.13' + readFileSync(f.request.projectFile, 'utf8'))
    .digest('hex');
  const envDir = join(f.settings.julia.cacheDir, 'envs', key.slice(0, 16));
  mkdirSync(envDir, { recursive: true });
  for (const file of [join(envDir, 'lock'), join(f.settings.julia.cacheDir, 'depot.lock')]) {
    writeFileSync(file, 'stale');
    utimesSync(file, new Date(0), new Date(0));
  }
  assert.ok(f.run());
  assert.ok(!existsSync(join(envDir, 'lock')));
});

test('resolver: concurrent workers share one installation', async (t) => {
  const f = fixture(t, 'delay');
  const code = `import {resolveEnvironment} from './src/resolver/index.js'; console.log(JSON.stringify(resolveEnvironment(${JSON.stringify(f.request)}, ${JSON.stringify(f.settings)})));`;
  const worker = () =>
    new Promise((accept, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
        cwd: sourceRoot,
      });
      let stdout = '',
        stderr = '';
      child.stdout.on('data', (data) => {
        stdout += data;
      });
      child.stderr.on('data', (data) => {
        stderr += data;
      });
      child.on('error', reject);
      child.on('close', (status) =>
        status === 0 ? accept(JSON.parse(stdout)) : reject(Error(stderr)),
      );
    });
  const results = await Promise.all([worker(), worker()]);
  assert.deepEqual(results.map((r) => r.cached).sort(), [false, true]);
  assert.equal(readFileSync(join(f.settings.julia.cacheDir, 'depot/calls'), 'utf8'), 'call\n');
});

test('resolver: missing entries and corrupt metadata are rebuilt', (t) => {
  const f = fixture(t);
  const first = f.run();
  rmSync(first.packages.Foo.entry);
  assert.equal(f.run().cached, false);
  writeFileSync(join(first.envDir, 'env.json'), '{broken');
  assert.equal(f.run().cached, false);
  assert.equal(
    readFileSync(join(f.settings.julia.cacheDir, 'depot/calls'), 'utf8'),
    'call\ncall\ncall\n',
  );
});

test('resolver: input changes get separate keys; packageName does not', (t) => {
  const f = fixture(t);
  const first = f.run();
  f.request.packageName = 'Foo';
  assert.equal(f.run().key, first.key);
  writeFileSync(
    f.request.projectFile,
    '# new project text\n' + readFileSync(f.request.projectFile, 'utf8'),
  );
  const second = f.run();
  assert.notEqual(second.key, first.key);
  f.request.manifestFile = join(f.dir, 'Manifest.toml');
  writeFileSync(f.request.manifestFile, `[[deps.Foo]]\nuuid = '${uuid}'\n`);
  assert.notEqual(f.run().key, second.key);
});

test('resolver: a Manifest larger than a command-line argument is resolved', (t) => {
  const f = fixture(t);
  f.request.manifestFile = join(f.dir, 'Manifest.toml');
  const filler = Array.from(
    { length: 4000 },
    (_, i) => `[[deps.Pad${i}]]\nuuid = "00000000-0000-4000-8000-${String(i).padStart(12, '0')}"\n`,
  ).join('\n');
  assert.ok(filler.length > 200000);
  writeFileSync(f.request.manifestFile, `[[deps.Foo]]\nuuid = "${uuid}"\n\n${filler}`);
  const result = f.run();
  assert.ok(result);
  assert.equal(result.packages.Foo.uuid, uuid);
});

test('resolver: relative Manifest paths of two checkouts get separate keys', (t) => {
  const f = fixture(t);
  const keys = [];
  for (const checkout of ['one', 'two']) {
    const dir = join(f.dir, checkout, 'P');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'Project.toml'), `[deps]\nFoo = "${uuid}"\n`);
    writeFileSync(join(dir, 'Manifest.toml'), `[[deps.Dep]]\npath = "../Dep"\nuuid = "${uuid}"\n`);
    const result = resolveEnvironment(
      { projectFile: join(dir, 'Project.toml'), manifestFile: join(dir, 'Manifest.toml') },
      f.settings,
    );
    assert.ok(result);
    assert.equal(result.cached, false);
    keys.push(result.key);
  }
  assert.notEqual(keys[0], keys[1]);
});

test('resolver: a lock whose holder exited is taken over at once; a live one is not', (t) => {
  const f = fixture(t);
  const key = createHash('sha256')
    .update('1.13' + readFileSync(f.request.projectFile, 'utf8'))
    .digest('hex');
  const envDir = join(f.settings.julia.cacheDir, 'envs', key.slice(0, 16));
  mkdirSync(envDir, { recursive: true });
  const far = Date.now() + 3600000;
  // A pid that has exited: a finished child process's.
  const gone = spawnSync(process.execPath, ['-e', '']).pid;
  writeFileSync(join(envDir, 'lock'), `other ${far} ${hostname()} ${gone}`);
  const started = Date.now();
  assert.ok(f.run());
  assert.ok(Date.now() - started < 8000);
  rmSync(f.settings.julia.cacheDir, { recursive: true });
  mkdirSync(envDir, { recursive: true });
  writeFileSync(join(envDir, 'lock'), `other ${far} ${hostname()} ${process.pid}`);
  f.settings.julia.resolverTimeout = 0.3;
  assert.equal(f.run(), null);
  assert.ok(!existsSync(join(envDir, 'failed.json')), 'waiting on a live lock is not a failure');
});

test('resolver: a depot it did not create is never pruned', (t) => {
  const f = fixture(t);
  const depot = join(f.settings.julia.cacheDir, 'depot');
  mkdirSync(join(depot, 'packages/Real/xyz'), { recursive: true });
  writeFileSync(join(depot, 'packages/Real/xyz/README.md'), 'keep me');
  assert.equal(f.run(), null);
  assert.equal(readFileSync(join(depot, 'packages/Real/xyz/README.md'), 'utf8'), 'keep me');
});
