import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { engine } from '../helpers.js';

const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
// A package tree in a fresh directory: { 'relative/path': text }.
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'orphan-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const project = (name, extra = '') =>
  `name = "${name}"\nuuid = "7b1e0a3e-0000-4000-8000-000000000000"\n${extra}`;
// The files the rule reports, relative to `root`, with their messages.
async function orphans(root, files, options) {
  const eslint = engine(
    { 'julia/no-orphan-file': options ? ['warn', options] : 'warn' },
    { cwd: root },
  );
  const results = await eslint.lintFiles(files.map((f) => join(root, f)));
  return Object.fromEntries(
    results
      .filter((r) => r.messages.length)
      .map((r) => [
        r.filePath
          .slice(root.length + 1)
          .split('\\')
          .join('/'),
        r.messages,
      ]),
  );
}

describe('no-orphan-file', () => {
  it('reports package files no entry point includes, once, at the first line', async () => {
    const root = tree({
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': 'module Pkg\ninclude("used.jl")\nend\n',
      'src/used.jl': 'f() = 1\n',
      'src/stale.jl': 'g() = 2\nh() = 3\n',
      'test/runtests.jl': 'using Pkg, Test\ninclude("basics.jl")\n',
      'test/basics.jl': '@test true\n',
      'test/forgotten.jl': '@test false\n',
    });
    const found = await orphans(root, [
      'src/Pkg.jl',
      'src/used.jl',
      'src/stale.jl',
      'test/runtests.jl',
      'test/basics.jl',
      'test/forgotten.jl',
    ]);
    assert.deepEqual(Object.keys(found).sort(), ['src/stale.jl', 'test/forgotten.jl']);
    const [message] = found['src/stale.jl'];
    assert.equal(found['src/stale.jl'].length, 1);
    assert.equal(message.line, 1);
    assert.equal(message.column, 1);
    assert.equal(
      message.message,
      'This file is not included from any entry point (src/Pkg.jl, test/runtests.jl); it never runs. Delete it, include it, or add it to entryPoints.',
    );
  });

  it('follows extensions, include forms and computed includes', async () => {
    const root = tree({
      'Project.toml': project('Pkg', '[weakdeps]\nFoo = "1"\n[extensions]\nPkgFooExt = "Foo"\n'),
      'src/Pkg.jl': [
        'module Pkg',
        'include(joinpath(@__DIR__, "a", "one.jl"))',
        'Base.include(@__MODULE__, "two.jl")',
        'function later()',
        '    include("three.jl")',
        'end',
        'for part in ("x", "y")',
        '    include("parts/$(part).jl")',
        'end',
        'foreach(include, readdir(joinpath(@__DIR__, "listed"); join = true))',
        'const GEN = joinpath(@__DIR__, "gen")',
        'include(joinpath(GEN, "made.jl"))',
        'end',
      ].join('\n'),
      'src/a/one.jl': '',
      'src/two.jl': '',
      'src/three.jl': '',
      'src/parts/x.jl': '',
      'src/parts/z.jl': '',
      'src/listed/any.jl': '',
      'src/gen/made.jl': '',
      'ext/PkgFooExt/PkgFooExt.jl': 'module PkgFooExt\ninclude("glue.jl")\nend\n',
      'ext/PkgFooExt/glue.jl': '',
      'ext/old.jl': '',
    });
    const found = await orphans(root, [
      'src/a/one.jl',
      'src/two.jl',
      'src/three.jl',
      'src/parts/x.jl',
      'src/parts/z.jl',
      'src/listed/any.jl',
      'src/gen/made.jl',
      'ext/PkgFooExt/glue.jl',
      'ext/old.jl',
    ]);
    // `parts/$(part).jl` could name `z.jl` too: never reported.
    assert.deepEqual(Object.keys(found), ['ext/old.jl']);
    assert.match(found['ext/old.jl'][0].message, /\(src\/Pkg\.jl, ext\/\)/u);
  });

  it('counts paths named in strings, commands, directories and CI as reached', async () => {
    const root = tree({
      '.git/HEAD': 'ref: refs/heads/main\n',
      '.github/workflows/ci.yml': 'steps:\n  - run: julia --project test/quality.jl\n',
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': 'module Pkg\nend\n',
      'test/runtests.jl': [
        'cmd = `$(Base.julia_cmd()) $(joinpath(@__DIR__, "sub", "worker.jl"))`',
        'push!(LOAD_PATH, joinpath(@__DIR__, "fixtures"))',
        'const FILES = ["listed.jl"]',
      ].join('\n'),
      'test/sub/worker.jl': '',
      'test/fixtures/Fixture.jl': 'module Fixture end\n',
      'test/listed.jl': '',
      'test/quality.jl': '',
      'test/unused.jl': '',
    });
    const found = await orphans(root, [
      'test/sub/worker.jl',
      'test/fixtures/Fixture.jl',
      'test/listed.jl',
      'test/quality.jl',
      'test/unused.jl',
    ]);
    assert.deepEqual(Object.keys(found), ['test/unused.jl']);
  });

  it('exempts scripts, files run on their own, nested environments and fixtures', async () => {
    const root = tree({
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': 'module Pkg\nend\n',
      'test/runtests.jl': '',
      'build.jl': '',
      'docs/make.jl': '',
      'docs/src/example.jl': '',
      'benchmark/run.jl': 'include("cases.jl")\n',
      'benchmark/cases.jl': '',
      'deps/build.jl': '',
      'test/items.jl': '@testitem "one" begin\n    @test true\nend\n',
      'test/shebang.jl': '#!/usr/bin/env julia\n',
      'test/cli.jl': 'n = parse(Int, ARGS[1])\n',
      'test/documented.jl': '# Run: julia --project test/documented.jl\n',
      'test/sub/runtests.jl': 'include("case.jl")\n',
      'test/sub/case.jl': '',
      'tutorial/Project.toml': '[deps]\n',
      'tutorial/run.jl': '',
      '.ci/check.jl': '',
      'notebook.jl': '### A Pluto.jl notebook ###\n',
      'test/pkgs/Fixture/Project.toml': project('Fixture'),
      'test/pkgs/Fixture/src/Fixture.jl': 'module Fixture end\n',
      'test/pkgs/Fixture/src/edited.jl': '',
    });
    const files = [
      'build.jl',
      'docs/make.jl',
      'docs/src/example.jl',
      'benchmark/run.jl',
      'benchmark/cases.jl',
      'deps/build.jl',
      'test/items.jl',
      'test/shebang.jl',
      'test/cli.jl',
      'test/documented.jl',
      'test/sub/runtests.jl',
      'test/sub/case.jl',
      'tutorial/run.jl',
      '.ci/check.jl',
      'notebook.jl',
      'test/pkgs/Fixture/src/edited.jl',
    ];
    assert.deepEqual(await orphans(root, files), {});
    // `scripts` replaces the default list.
    assert.deepEqual(
      Object.keys(await orphans(root, ['build.jl', 'docs/make.jl'], { scripts: [] })),
      ['build.jl', 'docs/make.jl'],
    );
  });

  it('takes configured entry points', async () => {
    const root = tree({
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': 'module Pkg\nend\n',
      'dev/run.jl': 'include("helper.jl")\n',
      'dev/helper.jl': '',
      'dev/other.jl': '',
    });
    assert.deepEqual(Object.keys(await orphans(root, ['dev/run.jl', 'dev/helper.jl'])).sort(), [
      'dev/helper.jl',
      'dev/run.jl',
    ]);
    assert.deepEqual(
      await orphans(root, ['dev/run.jl', 'dev/helper.jl'], { entryPoints: ['dev/run.jl'] }),
      {},
    );
    const found = await orphans(root, ['dev/other.jl'], { entryPoints: ['dev/run.jl'] });
    assert.match(found['dev/other.jl'][0].message, /\(src\/Pkg\.jl, entryPoints\)/u);
  });

  it('stays silent without a package, an entry point, or a readable includer', async () => {
    const root = tree({
      'loose/script.jl': '',
      'env/Project.toml': '[deps]\n',
      'env/src/thing.jl': '',
      'NoEntry/Project.toml': project('NoEntry'),
      'NoEntry/lib/thing.jl': '',
      'Broken/Project.toml': project('Broken'),
      'Broken/src/Broken.jl': 'module Broken\ninclude(\nend\n',
      'Broken/src/maybe.jl': '',
    });
    assert.deepEqual(
      await orphans(root, [
        'loose/script.jl',
        'env/src/thing.jl',
        'NoEntry/lib/thing.jl',
        'Broken/src/maybe.jl',
      ]),
      {},
    );
  });

  it('reviews: bounded patterns, project changes, directory words, monorepos, runners', async () => {
    // Many interpolations next to a long file name must not hang the matcher.
    const slow = tree({
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': `module Pkg\ninclude("parts/${'$a'.repeat(24)}/needle.jl")\nend\n`,
      [`src/parts/${'x'.repeat(80)}.jl`]: '',
      'src/other/stale.jl': '',
    });
    const started = Date.now();
    assert.deepEqual(Object.keys(await orphans(slow, ['src/other/stale.jl'])), [
      'src/other/stale.jl',
    ]);
    assert.ok(Date.now() - started < 2000);

    // Declaring an extension later is seen without restarting.
    const ext = tree({
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': 'module Pkg\nend\n',
      'ext/PExt.jl': 'module PExt end\n',
    });
    assert.deepEqual(Object.keys(await orphans(ext, ['ext/PExt.jl'])), ['ext/PExt.jl']);
    writeFileSync(
      join(ext, 'Project.toml'),
      project('Pkg', '[weakdeps]\nDates = "1"\n[extensions]\nPExt = "Dates"\n'),
    );
    assert.deepEqual(await orphans(ext, ['ext/PExt.jl']), {});

    // A testset named like a directory doesn't reach the directory.
    const words = tree({
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': 'module Pkg\nend\n',
      'test/runtests.jl':
        '@testset "integration" begin\n    include("integration/a.jl")\nend\npush!(LOAD_PATH, "fixtures")\n',
      'test/integration/a.jl': '',
      'test/integration/stale.jl': '',
      'test/fixtures/F.jl': '',
    });
    assert.deepEqual(
      Object.keys(await orphans(words, ['test/integration/stale.jl', 'test/fixtures/F.jl'])),
      ['test/integration/stale.jl'],
    );

    // A file included only from a package below this one (a monorepo's sub-package).
    const mono = tree({
      'Project.toml': project('Mono'),
      'src/Mono.jl': 'module Mono\nend\n',
      'test/runtests.jl': 'include("core.jl")\n',
      'test/core.jl': '',
      'test/shared/common.jl': '',
      'lib/Sub/Project.toml': project('Sub'),
      'lib/Sub/src/Sub.jl': 'module Sub\nend\n',
      'lib/Sub/test/runtests.jl': 'include("../../../test/shared/common.jl")\n',
    });
    assert.deepEqual(await orphans(mono, ['test/shared/common.jl']), {});

    // A test runner that discovers files itself names none of them.
    const runner = tree({
      'Project.toml': project('Ptr'),
      'src/Ptr.jl': 'module Ptr\nend\n',
      'src/stale.jl': '',
      'test/runtests.jl': 'using ParallelTestRunner\nimport Ptr\nruntests(Ptr, ARGS)\n',
      'test/basics.jl': '@test true\n',
    });
    assert.deepEqual(Object.keys(await orphans(runner, ['test/basics.jl', 'src/stale.jl'])), [
      'src/stale.jl',
    ]);
  });
  it('a bare file name under a computed directory may be any file of that name', async () => {
    const root = tree({
      'Project.toml': project('Pkg'),
      'src/Pkg.jl': 'module Pkg\ninclude("eval/manager.jl")\nend\n',
      'src/eval/manager.jl': 'loader() = joinpath(root_dir(), "src", "runner", "Loader.jl")\n',
      'src/runner/Loader.jl': '',
      'src/runner/Unused.jl': '',
    });
    assert.deepEqual(
      Object.keys(await orphans(root, ['src/runner/Loader.jl', 'src/runner/Unused.jl'])),
      ['src/runner/Unused.jl'],
    );
  });
});
