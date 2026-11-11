import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { engine } from '../helpers.js';

const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'harness-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const project = 'name = "Pk"\nuuid = "7b1e0a3e-0000-4000-8000-000000000001"\n';
async function undef(root, file) {
  const eslint = engine({ 'julia/no-undef': 'warn' }, { cwd: root });
  const [result] = await eslint.lintFiles([join(root, file)]);
  return result.messages.map((m) => m.message);
}
// A test file that imports its package (so it can run alone) and that the harness includes
// by a computed path runs after the harness's top level.
describe('no-undef: test files a harness includes by a computed path', () => {
  const t1 =
    'using Pk, Test\n@testset "t1" begin\n    @test util_helper() == pf()\nend\ncheck(x) = x + util_const\n';
  it('a readdir loop', async () => {
    const root = tree({
      'Project.toml': project,
      'src/Pk.jl': 'module Pk\nexport pf\npf() = 1\nend\n',
      'test/runtests.jl':
        'using Pk, Test\ninclude("utils.jl")\nconst util_const = 1\nfor f in filter(endswith(".jl"), readdir(@__DIR__))\n    f in ("runtests.jl", "utils.jl") || include(f)\nend\n',
      'test/utils.jl': 'util_helper() = 1\n',
      'test/t1.jl': t1,
    });
    assert.deepEqual(await undef(root, 'test/t1.jl'), []);
  });
  it('an interpolated name', async () => {
    const root = tree({
      'Project.toml': project,
      'src/Pk.jl': 'module Pk\nexport pf\npf() = 1\nend\n',
      'test/runtests.jl':
        'using Pk, Test\ninclude("utils.jl")\nconst util_const = 1\n@testset "$f" for f in ["t1"]\n    include("$f.jl")\nend\n',
      'test/utils.jl': 'util_helper() = 1\n',
      'test/t1.jl': `${t1}g() = 1 + not_anywhere\n`,
    });
    // Still checked, at fragment confidence: a name nothing defines is reported.
    const messages = await undef(root, 'test/t1.jl');
    assert.equal(messages.length, 1);
    assert.match(messages[0], /"not_anywhere" is not defined in this function or file/u);
  });
});
