#!/usr/bin/env node
// Warms the resolver cache for an environment, as lint would resolve it (for CI):
//   npx eslint-plugin-julia-resolve-env Project.toml --pkgjl DIR [--pkg-wasm DIR] [--cache DIR]
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { resolveEnvironment } from './index.js';
import { MANIFESTS } from './toml.js';

const [file, ...flags] = process.argv.slice(2);
const options = { '--pkgjl': 'pkgjl', '--pkg-wasm': 'pkgWasm', '--cache': 'cacheDir' };
const julia = {};
if (!file || flags.length % 2 || flags.some((flag, i) => i % 2 === 0 && !options[flag])) {
  console.error(
    'Usage: eslint-plugin-julia-resolve-env <Project.toml> [--pkgjl P] [--pkg-wasm DIR] [--cache DIR]',
  );
  process.exitCode = 1;
} else {
  for (let i = 0; i < flags.length; i += 2) julia[options[flags[i]]] = resolve(flags[i + 1]);
  const projectFile = resolve(file);
  // The same Manifest lint picks, so the warmed key is the one lint looks up.
  const manifestFile =
    MANIFESTS.map((m) => join(dirname(projectFile), m)).find((m) => existsSync(m)) ?? null;
  const result = resolveEnvironment({ projectFile, manifestFile }, { julia });
  console.log(JSON.stringify(result, null, 2));
  if (!result) process.exitCode = 1;
}
