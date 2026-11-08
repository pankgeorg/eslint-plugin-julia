// Packaging smoke test: `npm pack` this repository, install the tarball into a scratch
// project next to ESLint, and lint a small Julia file through the ESLint CLI, the way
// docs/usage.md tells users to.
//
// Usage: node scripts/smoke-pack.mjs [eslint version range, default ^10]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const eslintRange = process.argv[2] ?? '^10';
const root = resolve(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';
const work = mkdtempSync(join(tmpdir(), 'eslint-plugin-julia-smoke-'));
try {
  const packed = JSON.parse(
    execFileSync(npm, ['pack', '--json', '--pack-destination', work], { cwd: root, shell, encoding: 'utf8' }),
  )[0];
  const shipped = packed.files.map((f) => f.path);
  for (const required of ['wasm/parser.wasm', 'wasm/manifest.json', 'data/stdlib-exports.json', 'src/index.js', 'LICENSE'])
    assert.ok(shipped.includes(required), `tarball is missing ${required}`);
  for (const path of shipped)
    assert.ok(!/^(tests|scripts|docs)\//u.test(path), `tarball ships a development file: ${path}`);

  const project = join(work, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync(npm, ['install', '--no-audit', '--no-fund', '--save-dev', `eslint@${eslintRange}`, join(work, packed.filename)], {
    cwd: project,
    shell,
    stdio: 'inherit',
  });
  writeFileSync(
    join(project, 'eslint.config.js'),
    "import julia from 'eslint-plugin-julia';\n\nexport default [julia.configs.recommended];\n",
  );
  writeFileSync(join(project, 'clean.jl'), 'function mean(xs)\n    return sum(xs) / length(xs)\nend\n');
  writeFileSync(join(project, 'bug.jl'), 'f(x) = x == NaN\n');

  const run = (...args) => spawnSync(npx, ['--no-install', 'eslint', ...args], { cwd: project, shell, encoding: 'utf8' });
  const clean = run('clean.jl');
  assert.equal(clean.status, 0, `clean file should pass:\n${clean.stdout}${clean.stderr}`);
  const bug = run('--format', 'json', 'bug.jl');
  assert.equal(bug.status, 1, `bug file should fail:\n${bug.stdout}${bug.stderr}`);
  const [result] = JSON.parse(bug.stdout);
  assert.deepEqual(
    result.messages.map((m) => m.ruleId),
    ['julia/use-isnan'],
  );
  const all = run('**/*.jl');
  assert.equal(all.status, 1, 'a glob over the project should find the bug');
  const version = run('--version').stdout.trim();
  console.log(`smoke test passed: ${packed.filename} (${shipped.length} files) with ESLint ${version}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
