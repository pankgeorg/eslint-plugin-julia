import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { resolveEnvironment } from '../src/resolver/index.js';

const [file, ...flags] = process.argv.slice(2);
const options = { '--pkgjl': 'pkgjl', '--pkg-wasm': 'pkgWasm', '--cache': 'cacheDir' };
const julia = {};
if (!file || flags.length % 2 || flags.some((flag, i) => i % 2 === 0 && !options[flag])) {
  console.error(
    'Usage: node scripts/resolve-env.mjs <Project.toml> [--pkgjl P] [--pkg-wasm DIR] [--cache DIR]',
  );
  process.exitCode = 1;
} else {
  for (let i = 0; i < flags.length; i += 2) julia[options[flags[i]]] = resolve(flags[i + 1]);
  const projectFile = resolve(file),
    manifestFile = join(dirname(projectFile), 'Manifest.toml');
  const result = resolveEnvironment(
    { projectFile, manifestFile: existsSync(manifestFile) ? manifestFile : null },
    { julia },
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result) process.exitCode = 1;
}
