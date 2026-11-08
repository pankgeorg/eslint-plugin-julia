// Usage: node scripts/measure-rule.mjs RULE SAMPLE_LIST PROJECT_DIR...
// Each run enables exactly one rule, uses physical file paths and ignores no files.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ESLint, Linter } from 'eslint';
import plugin from '../src/index.js';
const [rule, list, ...projects] = process.argv.slice(2);
if (!plugin.rules[rule] || !list)
  throw new Error('Expected a rule, sample list and optional project directories.');
const eslint = new ESLint({
  cwd: process.cwd(),
  overrideConfigFile: true,
  ignore: false,
  allowInlineConfig: false,
  overrideConfig: [
    {
      files: ['**/*.jl'],
      plugins: { julia: plugin },
      language: 'julia/julia',
      rules: { [`julia/${rule}`]: 'warn' },
    },
  ],
});
// Linter accepts a normalized config provider. Apply the clone's config to external
// files without ESLint's discovery boundary, retaining cwd and physicalFilename.
const config = await eslint.calculateConfigForFile(join(process.cwd(), 'measurement.jl'));
const configs = Object.assign([], { getConfig: () => config });
const linter = new Linter({ cwd: process.cwd() });
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() && !e.name.startsWith('.')
      ? files(join(dir, e.name))
      : e.isFile() && e.name.endsWith('.jl')
        ? [join(dir, e.name)]
        : [],
  );
}
const groups = [readFileSync(list, 'utf8').trim().split(/\r?\n/u), ...projects.map(files)];
const result = [];
for (const [i, paths] of groups.entries()) {
  const findings = [];
  let fatal = 0;
  for (const path of paths) {
    const messages = linter.verify(readFileSync(path, 'utf8'), configs, {
      filename: resolve(path),
      physicalFilename: resolve(path),
      allowInlineConfig: false,
    });
    if (messages.some((m) => /(?:outside of base path|no matching configuration)/u.test(m.message)))
      throw new Error(`Unconfigured file: ${path}`);
    fatal += messages.filter((m) => m.fatal).length;
    for (const message of messages)
      if (message.ruleId === `julia/${rule}`)
        findings.push({
          path,
          line: message.line,
          column: message.column,
          message: message.message,
        });
  }
  result.push({ files: paths.length, fatal, count: findings.length, findings });
  console.log(JSON.stringify({ group: i, ...result.at(-1) }));
}
if (process.env.MEASURE_OUTPUT)
  writeFileSync(process.env.MEASURE_OUTPUT, JSON.stringify(result, null, 2));
