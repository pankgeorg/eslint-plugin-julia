# Environment resolver

When a linted file imports a package that [module resolution](module-resolution.md) can't find (no Manifest entry, or not installed in any depot), the plugin can ask an environment resolver for it. The resolver prepares a throwaway, cached, source-only copy of the file's environment (the nearest `Project.toml`, and its `Manifest.toml` when there is one) and returns each package's entry file. Module resolution then reads those sources exactly as it reads an installed package. It asks once per linted environment, lazily: files whose imports all resolve locally never start it, and a dependency's own imports are looked up in the same environment.

The default backend runs stock Pkg compiled to WebAssembly under Node: a Pkg-in-Wasm resolver, installed separately and configured via `settings.julia.pkgjl`. It never runs a native `julia`, and never touches the project's own files or the user's depot.

`src/resolver/index.js` exports the synchronous `resolveEnvironment(request, settings)`.

A request contains an absolute `projectFile`, an optional `manifestFile` (or `null`), and optionally `packageName` to exclude the project's own package. The original files are never modified. Relative `path` values in Project `[sources]` tables (including inline tables) and Manifest entries become absolute, relative to the original containing file. The copied Project retains its name and UUID. If instantiation with a Manifest fails, the resolver retries once without it.

A successful result contains `packages: { Name: { uuid, entry } }`, `key`, `envDir`, `cached`, `seconds`, and cache `stats`. Standard libraries with no located entry are omitted. A custom resolver can omit cache metadata and UUIDs. Failures return `null`; linting can continue with incomplete dependency information.

## Settings

All settings live under ESLint `settings.julia`:

| Setting           | Default                                                                         | Meaning                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolver`        | `"pkgjl"` if `pkgjl` is set, otherwise `"none"`                                 | `"pkgjl"`, `"none"`, or a synchronous function `fn(request)` returning `{ packages: { Name: entryFileOrObject } }` or `null`. Entry objects have `entry` and optionally `uuid`.                                                     |
| `pkgjl`           | unset                                                                           | Directory containing a separately installed Pkg-in-Wasm resolver (configured via `settings.julia.pkgjl`). Its `dist/index.js` and `dist/withjuliapkg.js` are dynamically imported only in the child. It is not a plugin dependency. |
| `pkgWasm`         | unset                                                                           | Directory passed to `configurePkgWasm({ dir })`. When unset, the backend finds its own Wasm files.                                                                                                                                  |
| `node`            | `process.execPath`                                                              | Node executable for the child. Use Node 24 or newer with JSPI, even when ESLint itself runs on Node 22. The backend is unavailable on Windows.                                                                                      |
| `cacheDir`        | `$XDG_CACHE_HOME/eslint-plugin-julia`, otherwise `~/.cache/eslint-plugin-julia` | Cache root.                                                                                                                                                                                                                         |
| `resolverTimeout` | `600`                                                                           | Maximum seconds spent waiting for locks and running the child.                                                                                                                                                                      |
| `offline`         | `false`                                                                         | Only use complete cached environments; never start the backend. Applies to the `"pkgjl"` resolver.                                                                                                                                  |

For example:

```js
settings: {
  julia: {
    pkgjl: '/opt/pkg-resolver',
    pkgWasm: '/opt/pkg-wasm',
    node: '/opt/node24/bin/node',
    resolverTimeout: 600,
  },
}
```

## Cache and source filtering

The key is SHA-256 of the concatenation of `"1.13"`, the rewritten Project text, and the original Manifest text (or an empty string). Cache layout:

```text
<cache>/envs/<first-16-key-hex>/
  project/Project.toml
  project/Manifest.toml
  report.toml
  env.json
  failed.json                 # after failure
  lock                        # only while resolving
<cache>/depot/                # shared packages and registries
<cache>/depot.lock            # serializes cold installs and pruning
<cache>/home/
<cache>/tmp/
```

`env.json` is published atomically and stores the full key, Julia version `"1.13"`, package map, and stats: elapsed `seconds`, package count, `sourceBytes` kept, `removedBytes`, and `artifactsRemoved` (top-level artifact entries found). Warm calls read the cache without spawning; metadata is also memoized in process. Missing entry files invalidate the result. Restore the whole cache at the same absolute path when reusing it in CI, since entries contain absolute paths. Local path dependencies remain in their original locations and are never pruned; edits to their contents are not part of the environment key.

The child sets `JULIA_PKG_PRECOMPILE_AUTO=0` and `WASMHOST_PLATFORM=arch=wasm32;os=wasi`. The wasm32/wasi host platform tag prevents platform-specific binary artifacts from matching. Platform-independent artifacts can still download and are stripped afterwards. `JULIA_PKG_SERVER` is passed through when set. HOME, TMPDIR, and JULIA_DEPOT_PATH point inside the cache.

For every located package inside the cache depot, the filter keeps only `src/**/*.jl` and root `Project.toml` / `JuliaProject.toml`. Tests, documentation, build output, other source assets, and symlinks are removed. Depot `artifacts`, `clones`, `compiled`, `logs`, and `scratchspaces` are removed; registries remain for reuse. These copies are for source analysis and are not runnable package installations. Use a dedicated resolver cache.

An exclusive environment lock prevents duplicate work by parallel ESLint workers. Workers wait up to the configured timeout; stale locks can be replaced after that timeout. Cold operations also take a shared depot lock. Failures, including missing backend files, unavailable JSPI, Pkg errors, and timeouts, write `failed.json` with `{ error, at }`. They suppress retries for one hour across processes and for the rest of the current process. Offline misses return `null` without writing a failure.

## CI warmup

Install a Pkg-in-Wasm resolver separately, then run the CLI with a JSPI-capable Node:

```sh
node scripts/resolve-env.mjs Project.toml \
  --pkgjl /opt/pkg-resolver --pkg-wasm /opt/pkg-wasm --cache .cache/julia-resolver
```

`--pkg-wasm` and `--cache` are optional. The CLI discovers a sibling `Manifest.toml`, prints Result JSON, and exits unsuccessfully on `null`. Save the cache as a CI artifact and set ESLint's `cacheDir` to the same location. Use `offline: true` during linting if network access is undesirable. Failed cache records can be removed to retry immediately in a new process.

## Export index

The solved export tree of each package read from the resolver's cache (its exported and `public` names, its submodules, and what `@reexport using` adds) is kept in `<cache>/index/`, keyed by the package's entry file. The cached sources live in content-addressed directories, so an index entry never goes stale. A later lint process loads the index instead of parsing the package again.

## Measured

On a 2-dependency environment (7 packages after resolution), cold (registry download, instantiate, filter, index) 8.9 s for the whole ESLint run, warm 0.95 s. The cache is 8.6 MB, mostly the registry. No artifact was downloaded, even for environments with JLL packages (`FFTW_jll`, `MKL_jll`, `OpenSpecFun_jll`), and no file other than `src/**/*.jl` and `Project.toml` remains under `depot/packages`.
