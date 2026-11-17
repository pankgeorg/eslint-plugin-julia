# no-orphan-file

Reports a `.jl` file of a package that no entry point of the package reaches through `include`: the file never runs. The report is made once per file, at its first line.

```text
This file is not included from any entry point (src/Pkg.jl, ext/, test/runtests.jl); it never runs. Delete it, include it, or add it to entryPoints.
```

Typical findings are a test file that `test/runtests.jl` stopped including (its tests silently stopped running), a source file left behind after a refactor, and scratch experiments or prototypes next to the package's code.

## Entry points

The package is the one of the nearest `Project.toml` with a `name`. Its entry points are:

- the package module, `src/<Name>.jl`;
- each extension in `Project.toml`'s `[extensions]`: `ext/<Ext>.jl` or `ext/<Ext>/<Ext>.jl`;
- `test/runtests.jl`, and any other `runtests.jl` (a sub-suite run on its own);
- files matching the `entryPoints` option;
- files that run on their own (below).

From the entry points, every file reached is followed in turn:

- `include`, `Base.include(M, path)`, `includet`, `evalfile` and `include_dependency`, wherever they are written (also inside a function, a `@testset` or a quote);
- any `.jl` path or directory named in a reached file: a string, a `joinpath`/`normpath` of literals, `@__DIR__`, `pkgdir(...)`, a constant assigned once, or a word or `$(…)` inside a command literal. This covers a list of test files, a script run in a subprocess, a `LOAD_PATH` entry and a fixtures directory.

## Computed includes

A file that a computed include could reach is never reported:

- `include("parts/$(name).jl")` reaches every file the pattern matches, here `parts/*.jl`.
- `include(f)`, `include.(files)` or `foreach(include, files)` reach the directories the file lists with `readdir`/`walkdir`.
- Without such a listing, `include(f)` reaches every file below the including file's directory, and `foreach(include, files)` reaches the files whose paths are named elsewhere.
- A reached file that doesn't parse makes every file below its directory reached.

## Files that run on their own

These files are never reported, and they count as entry points for the files they include:

- Files matching the `scripts` option. The default is `*.jl` (the package's top level), `docs/**`, `benchmark/**`, `benchmarks/**`, `bench/**`, `perf/**`, `examples/**`, `scripts/**`, `tools/**`, `contrib/**`, `gen/**`, `bin/**` and `deps/build.jl`, all relative to the package directory.
- A shebang script.
- A file of test items (`@testitem`, `@testmodule`, `@testsnippet`, `@testsetup`), which TestItemRunner or ReTestItems discovers.
- A Pluto notebook.
- A file that reads `ARGS` or calls `exit(…)`.
- A file whose comment says how to run it (`# julia --project test/check.jl`).
- A file that CI or a shell script runs by path. These are looked up in `.github/workflows/`, `.buildkite/`, `.gitlab-ci.yml` and other CI files at the repository root, and in `*.sh`, `Makefile`, `justfile` and `*.yml` inside the package.

Also not reported:

- Files in hidden directories (`.ci/`, Pkg's `.pkg/` hooks).
- Files in a nested environment, meaning a directory below the package with its own `Project.toml`, other than `test/`.
- Files of a package that lives inside another package's `test/` directory (a test fixture).

## Options

- `entryPoints` (array of globs relative to the package directory, default `[]`): more entry points, such as `["dev/run.jl"]`.
- `scripts` (array of globs relative to the package directory): files run on their own. Setting it replaces the default list above.

`**` matches any number of directories; `*` and `?` match within one path segment.

## Edits

No automatic fix or suggestion: the intended correction requires review. Delete the file, `include` it from where it belongs, or add it to `entryPoints` or `scripts`.

## Fallbacks and limitations

- A file is not reported when the linter can't measure reachability: no named `Project.toml` above it, or a package with no entry point (no `src/<Name>.jl`, no `test/runtests.jl`, no extension and no configured entry).
- Entry points are read from disk, not from editor buffers.
- Paths built at run time by other means (an environment variable, a function's return value whose paths aren't written anywhere) aren't followed.
- A script kept in `test/` with no run instructions is reported. Add it to `scripts`.
- A test harness that names no file (a runner that discovers test files itself) leaves `test/` unmeasured.
- A bare file name (`"Loader.jl"`) reaches a package file of that name when the same file also spells each of its directories (`joinpath(root(), "src", "runner", "Loader.jl")`).

On a 16-repository corpus (4,235 files), the rule reports 33 files. A hand check of every finding found 32 that never run:

- 17 test files no harness includes;
- 6 source files left out of their package;
- 6 scratch experiments and prototypes;
- 3 empty or comment-only stubs.

The other one is a manual script kept in `test/`, with no run instructions. The rule is in `recommended` as a warning.

```julia
# src/Pkg.jl
module Pkg
include("core.jl")
end
# src/core.jl: reached.
# src/old_core.jl: reported, nothing includes it.
```
