import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseJulia } from '../../src/parser/syntax-tree.js';
import { JuliaSourceCode } from '../../src/source-code.js';
import { getScopeManager } from '../../src/scope.js';

// A throwaway package tree: { 'P/Project.toml': '…', 'P/src/P.jl': '…' }.
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'eslint-julia-env-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
function analyze(file, settings) {
  const text = readFileSync(file, 'utf8');
  return getScopeManager(new JuliaSourceCode(text, parseJulia(text)), {
    physicalFilename: file,
    settings,
  });
}
const unresolved = (m) =>
  m.references.filter((r) => !r.binding && !(r.opaque && !r.checked)).map((r) => r.name);
const moduleScope = (m, name) =>
  m.scopes.find((s) => s.kind === 'module' && s.node.children?.[0]?.value === name);
const project = (name) => `name = "${name}"\nuuid = "8f0e7c3a-1111-4222-8333-944455556666"\n`;

test('environments: Base, Core and stdlib submodules have export inventories', () => {
  const root = tree({
    'P/Project.toml': project('P'),
    'P/src/P.jl':
      'module P\nusing Base.BinaryPlatforms, LinearAlgebra.BLAS\nf() = (HostPlatform(), platforms_match, gemm!, nope)\nend\n',
  });
  const m = analyze(join(root, 'P/src/P.jl'));
  assert.deepEqual(unresolved(m), ['nope']);
  assert.deepEqual(moduleScope(m, 'P').bareUsing, []);
});

test('environments: `import ..f` binds f and never hides the module', () => {
  const root = tree({
    'P/Project.toml': project('P'),
    'P/src/P.jl':
      'module P\nimport TOML\nhelper() = 1\nmodule Sub\nimport ..helper, ..missing_fn\nusing ..TOML\ng() = (helper(), missing_fn(), parse, typo)\nend\nend\n',
  });
  const m = analyze(join(root, 'P/src/P.jl'));
  const sub = moduleScope(m, 'Sub');
  assert.deepEqual(sub.bareUsing, []);
  // `..TOML` follows P's `import TOML` to the stdlib's exports.
  assert.deepEqual(unresolved(m), ['typo']);
});

test('environments: package extensions are include-tree entries', () => {
  const root = tree({
    'P/Project.toml': project('P'),
    'P/src/P.jl': 'module P\nend\n',
    'P/ext/PExt/PExt.jl': 'module PExt\nusing Dates\nconst LIMIT = 3\ninclude("helpers.jl")\nend\n',
    'P/ext/PExt/helpers.jl': 'h() = (LIMIT, now(), typo)\n',
  });
  assert.deepEqual(unresolved(analyze(join(root, 'P/ext/PExt/helpers.jl'))), ['typo']);
});

test('environments: computed and run-time includes mark the module', () => {
  const root = tree({
    'P/Project.toml': project('P'),
    'P/src/P.jl':
      'module P\nfor f in ("a.jl",); include(f); end\nmodule Q\ninclude("q.jl")\nend\nend\n',
    'P/src/q.jl': 'q() = 1\n',
  });
  const m = analyze(join(root, 'P/src/P.jl'));
  assert.equal(moduleScope(m, 'P').dynamicIncludes, true);
  assert.equal(moduleScope(m, 'Q').dynamicIncludes, false);
});

test('environments: a function resolver is asked once, only for uninstalled packages', () => {
  const root = tree({
    'P/Project.toml': `${project('P')}[deps]\nDep = "11111111-2222-4333-8444-555555555555"\n`,
    'P/src/P.jl': 'module P\nusing Dates, Dep\nf() = (now(), dep_value, x, nope)\nend\n',
    'cache/depot/packages/Dep/AbCdE/src/Dep.jl':
      'module Dep\nusing Reexport\n@reexport using .Inner\nmodule Inner\nexport x\nx = 1\nend\nexport dep_value\ndep_value = 2\nend\n',
  });
  const requests = [];
  const resolver = (request) => {
    requests.push(request);
    return {
      packages: { Dep: join(root, 'cache/depot/packages/Dep/AbCdE/src/Dep.jl') },
      envDir: join(root, 'cache/envs/0123456789abcdef'),
    };
  };
  const m = analyze(join(root, 'P/src/P.jl'), { julia: { resolver } });
  assert.deepEqual(unresolved(m), ['nope']);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].projectFile, join(root, 'P/Project.toml'));
  assert.equal(requests[0].packageName, 'P');
  // The dependency's solved exports are kept beside the environment.
  assert.equal(readdirSync(join(root, 'cache/index')).length, 1);
  // Without settings, no resolver runs and `Dep` stays an unresolved `using`.
  const plain = analyze(join(root, 'P/src/P.jl'));
  assert.deepEqual(moduleScope(plain, 'P').bareUsing, ['Dep']);
  assert.ok(!existsSync(join(root, 'P/Manifest.toml')));
});

test('environments: a package graph solved from another environment is not reused', () => {
  // P depends on Dep, which only the resolver can supply. tools/ has an environment of its
  // own without Dep; a script there that loads P must not leave P's graph unresolved for P's
  // own files.
  const root = tree({
    'P/Project.toml': `${project('P')}[deps]\nDep = "8f0e7c3a-1111-4222-8333-944455550000"\n`,
    'P/src/P.jl': 'module P\nusing Dep\nf() = (dep_export, nope)\nend\n',
    'P/tools/Project.toml': '[deps]\n',
    'P/tools/script.jl': 'using P\nP.f()\n',
    'Dep/src/Dep.jl': 'module Dep\nexport dep_export\ndep_export = 1\nend\n',
  });
  const settings = {
    julia: {
      resolver: (request) =>
        request.projectFile === join(root, 'P/Project.toml')
          ? { packages: { Dep: join(root, 'Dep/src/Dep.jl') } }
          : { packages: {} },
    },
  };
  analyze(join(root, 'P/tools/script.jl'), settings);
  const m = analyze(join(root, 'P/src/P.jl'), settings);
  assert.deepEqual(unresolved(m), ['nope']);
  assert.deepEqual(moduleScope(m, 'P').bareUsing, []);
});

test("environments: a generated `using M: <names(M; all = true)>` imports M's own names", () => {
  // `names(M; all = true)` lists what M defines, not what M imports.
  const root = tree({
    'P/Project.toml': `${project('P')}[deps]\nDep = "8f0e7c3a-1111-4222-8333-944455550000"\n`,
    'P/src/P.jl': [
      'module P',
      'import Dep as D',
      'let allnames = names(D; all = true)',
      '    ex = Expr(:using, Expr(:(:), Expr(:., :Dep)))',
      '    for n in allnames',
      '        push!(ex.args[1].args, Expr(:., n))',
      '    end',
      '    @eval P $ex',
      'end',
      'f() = (own_dep(), imported_by_dep(), nope())',
      'end',
    ].join('\n'),
    'Dep/src/Dep.jl':
      'module Dep\nusing LinearAlgebra: norm as imported_by_dep\nown_dep() = 1\nend\n',
  });
  const settings = {
    julia: { resolver: () => ({ packages: { Dep: join(root, 'Dep/src/Dep.jl') } }) },
  };
  const m = analyze(join(root, 'P/src/P.jl'), settings);
  assert.deepEqual(
    unresolved(m).filter((n) => /_dep|nope/u.test(n)),
    ['imported_by_dep', 'nope'],
  );
  assert.deepEqual(moduleScope(m, 'P').bareUsing, []);
  assert.equal(moduleScope(m, 'P').dynamicDefinitions, false);
});
