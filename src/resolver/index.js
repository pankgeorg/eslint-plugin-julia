import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewritePaths } from './toml.js';

const memo = new Map(),
  failures = new Set();
const sleep = new Int32Array(new SharedArrayBuffer(4));
const child = fileURLToPath(new URL('./pkgjl-child.mjs', import.meta.url));
function cached(envDir, key) {
  try {
    const version = statSync(join(envDir, 'env.json')).mtimeMs;
    const hit = memo.get(envDir);
    const data =
      hit?.version === version
        ? hit.data
        : JSON.parse(readFileSync(join(envDir, 'env.json'), 'utf8'));
    if (
      data.key !== key ||
      data.julia !== '1.13' ||
      !data.packages ||
      !data.stats ||
      !Object.values(data.packages).every(
        (p) => typeof p.uuid === 'string' && typeof p.entry === 'string' && existsSync(p.entry),
      )
    )
      return null;
    memo.set(envDir, { version, data });
    return { ...data, envDir, cached: true, seconds: data.stats.seconds };
  } catch {
    return null;
  }
}
function failed(envDir) {
  if (failures.has(envDir)) return true;
  try {
    if (Date.now() - JSON.parse(readFileSync(join(envDir, 'failed.json'), 'utf8')).at < 3600000) {
      failures.add(envDir);
      return true;
    }
  } catch {
    /* No recent failure. */
  }
  return false;
}
function exclude(result, name) {
  if (!result || !name) return result;
  const packages = { ...result.packages };
  delete packages[name];
  return { ...result, packages };
}

export function resolveEnvironment(request, settings = {}) {
  let envDir;
  const locks = [];
  try {
    const options = settings.julia ?? {};
    const resolver = options.resolver ?? (options.pkgjl ? 'pkgjl' : 'none');
    if (typeof resolver === 'function') {
      const result = resolver(request);
      if (!result?.packages || result.then) return null;
      const packages = Object.fromEntries(
        Object.entries(result.packages).map(([name, value]) => [
          name,
          typeof value === 'string' ? { entry: value } : value,
        ]),
      );
      return exclude({ ...result, packages }, request.packageName);
    }
    if (resolver !== 'pkgjl') return null;
    const project = rewritePaths(readFileSync(request.projectFile, 'utf8'), request.projectFile);
    const manifest = request.manifestFile ? readFileSync(request.manifestFile, 'utf8') : '';
    const key = createHash('sha256')
      .update('1.13' + project + manifest)
      .digest('hex');
    const cache = resolve(
      options.cacheDir ??
        join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'eslint-plugin-julia'),
    );
    envDir = join(cache, 'envs', key.slice(0, 16));
    const warm = cached(envDir, key);
    if (warm) return exclude(warm, request.packageName);
    if (options.offline || failed(envDir)) return null;
    const timeout = Number(options.resolverTimeout ?? 600) * 1000;
    if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Invalid resolverTimeout');
    const deadline = Date.now() + timeout;
    mkdirSync(envDir, { recursive: true });
    // The depot lock also protects pruning from concurrent installs of other environments.
    for (const path of [join(envDir, 'lock'), join(cache, 'depot.lock')]) {
      const token = randomUUID();
      for (;;) {
        const ready = cached(envDir, key);
        if (ready) return exclude(ready, request.packageName);
        if (failed(envDir)) return null;
        if (Date.now() >= deadline) throw new Error('Resolver lock timeout');
        try {
          writeFileSync(path, token, { flag: 'wx' });
          locks.push({ path, token });
          break;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          try {
            if (Date.now() - statSync(path).mtimeMs > timeout) unlinkSync(path);
          } catch {
            /* Another worker released it. */
          }
          Atomics.wait(sleep, 0, 0, Math.min(50, Math.max(1, deadline - Date.now())));
        }
      }
    }
    const run = spawnSync(
      options.node ?? process.execPath,
      [
        child,
        JSON.stringify({
          key,
          cache,
          envDir,
          project,
          manifest: request.manifestFile ? rewritePaths(manifest, request.manifestFile, true) : '',
          pkgjl: options.pkgjl,
          pkgWasm: options.pkgWasm,
        }),
      ],
      { timeout: Math.max(1, deadline - Date.now()), encoding: 'utf8', maxBuffer: 1024 * 1024 },
    );
    if (run.error || run.status !== 0)
      throw run.error ?? new Error(run.stderr?.trim() || `Resolver exited ${run.status}`);
    const result = cached(envDir, key);
    if (!result) throw new Error('Resolver did not produce a complete environment');
    return exclude({ ...result, cached: false }, request.packageName);
  } catch (error) {
    if (envDir) {
      failures.add(envDir);
      try {
        mkdirSync(envDir, { recursive: true });
        const file = join(envDir, `failed-${process.pid}.tmp`);
        writeFileSync(
          file,
          JSON.stringify({ error: String(error.message ?? error), at: Date.now() }),
        );
        renameSync(file, join(envDir, 'failed.json'));
      } catch {
        /* An unwritable cache must not interrupt linting. */
      }
    }
    return null;
  } finally {
    for (const { path, token } of locks.reverse()) {
      try {
        if (readFileSync(path, 'utf8') === token) unlinkSync(path);
      } catch {
        /* Already released. */
      }
    }
  }
}
