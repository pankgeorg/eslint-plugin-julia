import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseJulia } from '../../src/parser/syntax-tree.js';
import { JuliaSourceCode } from '../../src/source-code.js';
import { getScopeManager, resolve } from '../../src/scope.js';
const root = fileURLToPath(new URL('../fixtures/packages/', import.meta.url));
function analyze(path, code, settings) {
  const file = join(root, path), text = code ?? readFileSync(file, 'utf8');
  const parsed = parseJulia(text); assert.deepEqual(parsed.diagnostics.filter(d => d.level === 1), []);
  const source = new JuliaSourceCode(text, parsed);
  return getScopeManager(source, { physicalFilename: file, settings });
}
function unresolved(m) { return m.references.filter(r => !r.binding && !r.opaque).map(r => r.name); }
function withDepot(fn) {
  const old = process.env.JULIA_DEPOT_PATH; process.env.JULIA_DEPOT_PATH = join(root, 'depot');
  try { fn(); } finally { if (old === undefined) delete process.env.JULIA_DEPOT_PATH; else process.env.JULIA_DEPOT_PATH = old; }
}
test('modules: reverse includes merge siblings, aliases, imports and stdlibs', () => withDepot(() => {
  const m = analyze('Tree/src/nested/last.jl');
  assert.deepEqual(unresolved(m), ['absent']);
  const dp = m.references.find(r => r.name === 'DP'); assert.equal(dp.binding.kind, 'import');
  assert.equal(resolve(dp.node), dp.binding);
}));
test('modules: included nested module stays isolated and resolves parent imports', () => withDepot(() => {
  const m = analyze('Tree/src/nested/sub-helper.jl');
  assert.deepEqual(unresolved(m), ['last_helper']);
  assert.ok(m.lookup('sibling')); assert.ok(m.lookup('sub_export'));
}));
test('modules: literal forward includes and cycles are safe', () => withDepot(() => {
  const m = analyze('Tree/src/Tree.jl');
  const tree = m.scopes.find(s => s.node.kind === 'module' && s.node.children[0].value === 'Tree');
  for (const name of ['sibling', 'last_helper', 'cycle_a', 'cycle_b', 'sub_export', 'dep_export']) assert.ok(m.lookup(name, tree), name);
  assert.equal(tree.bareUsing.length, 0);
}));
test('modules: unreachable files do not inherit package scope', () => withDepot(() => {
  assert.deepEqual(unresolved(analyze('Tree/src/unreachable.jl')), ['sibling']);
}));
test('modules: dependency exports, public and reexports traverse each own manifest', () => withDepot(() => {
  const m = analyze('Tree/src/unreachable.jl', 'using Dep; dep_export; dep_public; path_export; leaf_export; manufactured');
  assert.deepEqual(unresolved(m), ['manufactured']); assert.deepEqual(m.globalScope.bareUsing, []);
}));
test('modules: stdlib imports resolve but retain typos', () => {
  assert.deepEqual(unresolved(analyze('Tree/src/unreachable.jl', 'import LinearAlgebra; norm; typo')), ['typo']);
});
test('modules: unknown wildcard imports are recorded only on their module', () => {
  const m = analyze('Tree/src/unreachable.jl', 'module A; using NotInstalled; end; module B; typo; end');
  const a = m.scopes.find(s => s.node.children[0]?.value === 'A');
  const b = m.scopes.find(s => s.node.children[0]?.value === 'B');
  assert.deepEqual(a.bareUsing, ['NotInstalled']); assert.deepEqual(b.bareUsing, []);
});
test('modules: same-file relative using, parent imports and reexport fixed point', () => {
  const m = analyze('Tree/src/unreachable.jl', `module A
    using .Middle
    module Middle
      @reexport using ..Leaf
    end
    module Leaf
      export value
      value = 1
    end
    value
  end`);
  assert.deepEqual(unresolved(m), []);
});
test('modules: configurable entry files and unreachable fallback', () => {
  const settings = { julia: { entryFiles: [join(root, 'custom/entry.jl')] } };
  assert.deepEqual(unresolved(analyze('custom/child.jl', undefined, settings)), []);
  assert.ok(unresolved(analyze('custom/child.jl')).includes('custom_helper'));
});
test('modules: Base companions and baremodule inheritance', () => {
  const m = analyze('julia/base/core.jl');
  assert.deepEqual(unresolved(m), []); assert.equal(m.globalScope.bare, true);
});
test('modules: Julia source stdlib layout without Project.toml', () => {
  assert.deepEqual(unresolved(analyze('julia/stdlib/Example/src/helper.jl')), []);
});
test('modules: cache invalidates dependency edits and new includes within one process', () => {
  const dir = mkdtempSync(join(tmpdir(), 'julia-resolution-'));
  const entry = join(dir, 'entry.jl'), child = join(dir, 'child.jl'), dep = join(dir, 'dep.jl');
  const settings = { julia: { entryFiles: [entry] } };
  writeFileSync(entry, 'module CacheTest; include("child.jl"); include("dep.jl"); end');
  writeFileSync(child, 'old_name; new_name'); writeFileSync(dep, 'old_name=1');
  const run = () => {
    const text = readFileSync(child, 'utf8'); return getScopeManager(new JuliaSourceCode(text, parseJulia(text)), { physicalFilename: child, settings });
  };
  try {
    assert.deepEqual(unresolved(run()), ['new_name']);
    writeFileSync(dep, 'new_name=2');
    assert.deepEqual(unresolved(run()), ['old_name']);
    rmSync(dep); assert.deepEqual(unresolved(run()), ['old_name', 'new_name']);
    writeFileSync(dep, 'old_name=1; new_name=2'); assert.deepEqual(unresolved(run()), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('modules: unsaved source overlays do not reuse stale declarations', () => withDepot(() => {
  assert.deepEqual(unresolved(analyze('Tree/src/first.jl', 'scratch() = last_helper() + never_defined')), ['never_defined']);
}));

test('modules: Base bootstrap includes may be rooted at base/', () => {
  assert.deepEqual(unresolved(analyze('julia/base/nested/bootstrap.jl')), []);
});
test('modules: disk module models are shared between sibling lint targets', () => withDepot(() => {
  const a = analyze('Tree/src/first.jl'), b = analyze('Tree/src/nested/last.jl');
  assert.equal(a.moduleResolution.scopes.get(a.globalScope)[0], b.moduleResolution.scopes.get(b.globalScope)[0]);
}));
test('modules: shared metadata distinguishes resolved includes from dynamic names', () => withDepot(() => {
  const m = analyze('Tree/src/nested/last.jl');
  const [model] = m.moduleResolution.scopes.get(m.globalScope);
  assert.equal(model.unresolvedIncludes, false); assert.equal(model.dynamicEvaluation, false);
  assert.ok(model.reads.has('DP')); assert.ok(model.reads.has('sibling'));
  const dynamic = analyze('Tree/src/unreachable.jl', 'include(path); eval(:(generated=1))');
  const [uncertain] = dynamic.moduleResolution.scopes.get(dynamic.globalScope);
  assert.equal(uncertain.unresolvedIncludes, true); assert.equal(uncertain.dynamicEvaluation, true);
}));

test('modules: imported macro calls and qualified macro receivers count as uses', () => {
  const m = analyze('Tree/src/unreachable.jl', 'using Test: @test; @test true; import Test as T; T.@test true');
  const [model] = m.moduleResolution.scopes.get(m.globalScope);
  assert.ok(model.reads.has('@test')); assert.ok(model.reads.has('T'));
});

test('modules: unresolved reexports preserve the consumer wildcard fallback', () => {
  const m = analyze('Tree/src/unreachable.jl', 'module Outer; module Partial; @reexport using NotInstalled; end; using .Partial; end');
  const outer = m.scopes.find(s => s.node.children[0]?.value === 'Outer');
  assert.deepEqual(outer.bareUsing, ['.Partial']);
});

test('modules: method extensions count as module uses of imported functions', () => {
  const m = analyze('Tree/src/unreachable.jl', 'import Base: show; show(x::Int)=nothing');
  const [model] = m.moduleResolution.scopes.get(m.globalScope);
  assert.ok(model.reads.has('show'));
});

test('modules: eval macros mark dynamic use uncertainty without inventing names', () => {
  const m = analyze('Tree/src/unreachable.jl', '@eval $(Symbol("generated"))()=1');
  const [model] = m.moduleResolution.scopes.get(m.globalScope);
  assert.equal(model.dynamicEvaluation, true); assert.equal(m.lookup('generated'), null);
});

test('modules: empty generic declarations in an include join the module scope', () => {
  const m = analyze('custom/entry.jl', 'module Custom; include("child.jl"); declared_generic; end');
  assert.deepEqual(unresolved(m), []);
});
