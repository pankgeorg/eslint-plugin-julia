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
import { homedir, hostname } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threadId } from 'node:worker_threads';
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
// A unique temporary name: worker threads share a pid.
export const temporaryName = (base) => `${base}.${process.pid}.${threadId}.${randomUUID()}.tmp`;
const wait = (ms) => Atomics.wait(sleep, 0, 0, Math.max(1, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};
// Runs `fn` while holding `<path>.guard`, created exclusively; undefined if another process
// holds it. Locks are only created, taken over and released under the guard, so a stale
// lock is never removed after its replacement was created. A guard is held for a few file
// operations; one older than 30 s was left by a killed process.
function guarded(path, fn) {
  const guard = `${path}.guard`;
  try {
    writeFileSync(guard, `${process.pid}`, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    try {
      if (Date.now() - statSync(guard).mtimeMs > 30000) unlinkSync(guard);
    } catch {
      /* Released meanwhile. */
    }
    return undefined;
  }
  try {
    return fn();
  } finally {
    try {
      unlinkSync(guard);
    } catch {
      /* Already removed as stale. */
    }
  }
}
// A lock records its holder's token, deadline, host and pid: it is stale once the deadline
// has passed, or at once when its holder on this host has exited.
function stale(held, path, timeout) {
  const [, until, host, pid] = held.split(' ');
  if (host === hostname() && Number(pid) && !alive(Number(pid))) return true;
  const deadline = Number(until) || statSync(path).mtimeMs + timeout;
  return Date.now() > deadline + 5000;
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
    // The key hashes what the child receives: relative `path` entries are made absolute, so
    // two checkouts with the same Manifest don't share an environment.
    const manifest = request.manifestFile
      ? rewritePaths(readFileSync(request.manifestFile, 'utf8'), request.manifestFile, true)
      : '';
    const key = createHash('sha256')
      .update('1.13' + project + manifest)
      .digest('hex');
    const home = (path) => path.replace(/^~(?=$|[\\/])/u, homedir());
    const cache = resolve(
      options.cacheDir
        ? home(options.cacheDir)
        : join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'eslint-plugin-julia'),
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
        if (Date.now() >= deadline)
          throw Object.assign(new Error('Resolver lock timeout'), { transient: true });
        const taken = guarded(path, () => {
          let held = null;
          try {
            held = readFileSync(path, 'utf8');
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
          if (held !== null && !stale(held, path, timeout)) return false;
          writeFileSync(path, `${token} ${deadline} ${hostname()} ${process.pid}`);
          return true;
        });
        if (taken) {
          locks.push({ path, token });
          break;
        }
        wait(Math.min(50, deadline - Date.now()));
      }
    }
    // The request goes through stdin: a Manifest can exceed the command-line limit.
    const run = spawnSync(options.node ?? process.execPath, [child], {
      input: JSON.stringify({
        key,
        cache,
        envDir,
        project,
        manifest,
        pkgjl: options.pkgjl && home(options.pkgjl),
        pkgWasm: options.pkgWasm && home(options.pkgWasm),
      }),
      stdio: ['pipe', 'ignore', 'pipe'],
      timeout: Math.max(1, deadline - Date.now()),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (run.error || run.status !== 0)
      throw run.error ?? new Error(run.stderr?.trim() || `Resolver exited ${run.status}`);
    const result = cached(envDir, key);
    if (!result) throw new Error('Resolver did not produce a complete environment');
    return exclude({ ...result, cached: false }, request.packageName);
  } catch (error) {
    // Waiting out another worker's lock isn't a failure of this environment.
    if (envDir && !error.transient) {
      failures.add(envDir);
      try {
        mkdirSync(envDir, { recursive: true });
        const file = temporaryName(join(envDir, 'failed.json'));
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
    for (const { path, token } of locks.reverse())
      for (let attempt = 0; attempt < 200; attempt++) {
        const done = guarded(path, () => {
          try {
            if (readFileSync(path, 'utf8').split(' ')[0] === token) unlinkSync(path);
          } catch {
            /* Already released or taken over. */
          }
          return true;
        });
        if (done) break;
        wait(10);
      }
  }
}
