import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { manifestNames } from './toml.js';

async function main(args) {
  const start = performance.now();
  const { cache, envDir, key } = args;
  const depot = join(cache, 'depot'),
    project = join(envDir, 'project');
  for (const dir of [project, depot, join(cache, 'home'), join(cache, 'tmp')])
    mkdirSync(dir, { recursive: true });
  writeFileSync(join(project, 'Project.toml'), args.project);
  const manifest = join(project, 'Manifest.toml');
  rmSync(manifest, { force: true });
  if (args.manifest) writeFileSync(manifest, args.manifest);
  if (!args.pkgjl) throw new Error('Configure a Pkg-in-Wasm resolver via settings.julia.pkgjl');
  const backend = await import(pathToFileURL(resolve(args.pkgjl, 'dist/index.js')).href);
  const { juliaPkg } = await import(
    pathToFileURL(resolve(args.pkgjl, 'dist/withjuliapkg.js')).href
  );
  if (args.pkgWasm) backend.configurePkgWasm({ dir: args.pkgWasm });
  if (!backend.pkgWasmAvailable())
    throw new Error('Pkg-in-Wasm resolver unavailable (requires JSPI and a supported platform)');
  const target = {
    cwd: project,
    env: {
      HOME: join(cache, 'home'),
      JULIA_DEPOT_PATH: depot,
      TMPDIR: join(cache, 'tmp'),
      JULIA_PKG_PRECOMPILE_AUTO: '0',
      WASMHOST_PLATFORM: 'arch=wasm32;os=wasi',
      ...(process.env.JULIA_PKG_SERVER !== undefined
        ? { JULIA_PKG_SERVER: process.env.JULIA_PKG_SERVER }
        : {}),
    },
  };
  const instantiate = async () => {
    const result = await juliaPkg(
      target,
      { kind: 'instantiate' },
      {
        project,
        reportFile: join(envDir, 'report.toml'),
        requestId: 'eslint',
        onOutput: () => {},
      },
    );
    if (result.status !== 'ok' || result.report?.status !== true)
      throw new Error(result.report?.error || result.process?.stderr || 'Pkg instantiate failed');
  };
  try {
    await instantiate();
  } catch (error) {
    if (!args.manifest) throw error;
    rmSync(manifest, { force: true });
    await instantiate();
  }
  const names = manifestNames(readFileSync(manifest, 'utf8'));
  const packages = Object.create(null),
    roots = new Set();
  const packageRoot = join(depot, 'packages');
  mkdirSync(packageRoot, { recursive: true });
  for (const [uuid, entry] of Object.entries(backend.locate(target, project))) {
    if (!entry) continue; // Standard libraries have no source entry in the depot.
    const name = names.get(uuid);
    if (!name) throw new Error(`No Manifest name for ${uuid}`);
    packages[name] = { uuid, entry };
    const path = relative(packageRoot, entry);
    const parts = path.split(sep);
    if (!isAbsolute(path) && parts[0] !== '..' && parts.length >= 3)
      roots.add(join(packageRoot, parts[0], parts[1]));
  }
  const stats = {
    seconds: 0,
    packages: Object.keys(packages).length,
    sourceBytes: 0,
    removedBytes: 0,
    artifactsRemoved: 0,
  };
  function prune(path, root, discard = false) {
    const info = lstatSync(path);
    if (info.isDirectory()) {
      for (const file of readdirSync(path)) prune(join(path, file), root, discard);
      if (!readdirSync(path).length) rmSync(path, { recursive: true });
    } else {
      const local = relative(root, path);
      const keep =
        !discard &&
        !info.isSymbolicLink() &&
        (['Project.toml', 'JuliaProject.toml'].includes(local) ||
          (local.startsWith(`src${sep}`) && local.endsWith('.jl')));
      if (keep) stats.sourceBytes += info.size;
      else {
        stats.removedBytes += info.size;
        rmSync(path, { force: true });
      }
    }
  }
  for (const root of roots) prune(root, root);
  // Pkg also writes cache marker files outside individual package directories.
  for (const item of readdirSync(packageRoot, { withFileTypes: true }))
    if (!item.isDirectory()) prune(join(packageRoot, item.name), packageRoot, true);
  for (const name of ['artifacts', 'clones', 'compiled', 'logs', 'scratchspaces']) {
    const path = join(depot, name);
    try {
      if (name === 'artifacts') stats.artifactsRemoved = readdirSync(path).length;
      prune(path, path, true);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const { entry } of Object.values(packages))
    if (!lstatSync(entry).isFile()) throw new Error(`Missing source entry: ${entry}`);
  stats.seconds = (performance.now() - start) / 1000;
  const temporary = join(envDir, 'env.json.tmp');
  writeFileSync(temporary, JSON.stringify({ key, julia: '1.13', packages, stats }));
  renameSync(temporary, join(envDir, 'env.json'));
}
try {
  await main(JSON.parse(process.argv[2]));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
