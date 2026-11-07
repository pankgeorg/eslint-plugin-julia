// Optional, single-process benchmark; no tight timing assertions or corpus writes.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
const start = performance.now();
const { parseJulia } = await import('../src/parser/syntax-tree.js');
const loadMs = performance.now() - start;
const { default: julia } = await import('../src/index.js');
const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/benchmark.mjs FILE.jl [CORPUS_DIRECTORY]');
const text = readFileSync(filename, 'utf8'), parseMs = [];
let result;
for (let i = 0; i < 4; i++) {
  const tick = performance.now();
  result = parseJulia(text);
  parseMs.push(performance.now() - tick);
}
const eslint = new ESLint({ cwd: resolve(process.argv[3] ?? '.'), overrideConfigFile: true,
  overrideConfig: [julia.configs.recommended] });
const tick = performance.now();
const lint = process.argv[3] ? await eslint.lintFiles(['**/*.jl']) : await eslint.lintText(text, { filePath: resolve(filename) });
const lintMs = performance.now() - tick;
const byRule = {};
const samples = [];
for (const file of lint) for (const message of file.messages) {
  byRule[message.ruleId] = (byRule[message.ruleId] ?? 0) + 1;
  if (samples.length < 40) samples.push({ filePath: file.filePath, ...message });
}
console.log(JSON.stringify({ node: process.version, loadMs, bytes: result.bytes, rawCount: result.rawCount,
  parseMs, lintMs, files: lint.length, byRule, samples, rssBytes: process.memoryUsage().rss }, null, 2));
