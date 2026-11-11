# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-11-11

`no-undef` is now in `recommended`, and there is a new rule, `no-orphan-file`. On a
16-repository corpus (4,235 files), `no-undef`'s findings go from 8,969 to 115. An
independent triage labels 37 of those live bugs, 68 bugs in dead code and 10 false
positives. Every finding that triage, or the v0.2.0 survey, labelled a real bug is still
reported (in `strict` at least). #47

### Upgrading from 0.2.0

- `recommended` gains two warning rules, `no-undef` and `no-orphan-file`. A run with
  `--max-warnings 0` can start failing. To turn one off, set
  `'julia/no-undef': 'off'` (or `'julia/no-orphan-file': 'off'`) after the preset.
  - Escape hatches for `no-undef`: `globals`, and `settings.julia.macros` for package
    macros.
  - Escape hatches for `no-orphan-file`: `scripts` and `entryPoints`.
- `strict` sets `no-undef`'s `fragments: "report"`. It also reports names in files whose
  includer isn't visible, at lower confidence (7,188 findings on the corpus, mostly
  untriaged).
- More is reported than before:
  - `unknownModules: "ignore"` no longer silences a module with an unresolved `using`;
  - an unresolved bare `import M` no longer makes the module's names unknown;
  - `using M` no longer brings in names `M` only declares `public` (`OneTo`, `Fix1`).
- `no-unused-vars` and `no-use-before-define` change too, because macro arguments are now
  analyzed.
- `no-orphan-file` reads the package's directories, `.jl` files and CI configuration. Its
  results depend on the whole package, not only the linted file.

### Added

- An environment resolver (`settings.julia.resolver`): when a file imports a package that
  isn't in a manifest or installed, a throwaway, cached, source-only copy of its
  environment supplies the package's sources. The default backend is a Pkg-in-Wasm
  resolver, installed separately and configured via `settings.julia.pkgjl`; no artifacts
  are downloaded. Resolved packages' exports are kept in a persistent index. See
  `docs/environment-resolver.md` and the `eslint-plugin-julia-resolve-env` command.
- Macro signatures (`src/macro-signatures.js`, `settings.julia.macros`): which macro
  arguments are reads, which declare names (`@enum`, `@unpack`, `@variables`, …) and which
  are generated code or symbols. See `docs/macros.md`.
- Harness entries: `runtests.jl`, `make.jl` and `makedocs.jl` in a file's directory or
  above it (up to the package or repository root) are include-tree entries, so docs helpers
  share Documenter's imports.
- Include fragments assume their context: a test file no include reaches runs after its
  harness's top level and `using Package`; an import-free docs snippet likewise. They get
  only the narrowed check in `recommended`. New `no-undef` option `fragments: "report"`
  (on in `strict`) reports every unresolved read in a fragment, at lower confidence.
- Generated definitions under a literal prefix (`Symbol(:get_, prop)`) leave only that
  prefix unknown; a generated `using M: <names(M; all = true)>` imports M's own names.
- `@eval M code` resolves against every name `M` defines. Literal `eval(:(const x = …))`
  at top level defines `x`. A submodule filled by computed `Core.eval(Sub, ex)` has unknown
  exports.
- Macro signatures: `@test_skip`, `@test_broken`, `@test … skip=`/`broken=`,
  `@macroexpand` (not run as written); plot types (`@userplot`, `@shorthands`, Makie's
  `@recipe Name`) define their plotting functions; WGLMakie's `@handle`, SymbolicUtils'
  `@number_methods`, Symbolics' `@num_method`, JET's `@analyze_toplevel`.
- A module's docstring is evaluated inside the module.
- New rule `no-orphan-file` (in `recommended` as a warning): a package file that no entry
  point (`src/<Name>.jl`, `ext/`, `test/runtests.jl`, or the `entryPoints` option) reaches
  through `include` never runs. Files a computed include could reach, scripts (`docs/`,
  `bench/`, `examples/`, shebang and `ARGS` scripts, files CI runs by path, test items,
  Pluto notebooks; the `scripts` option) and nested environments are not reported. On the
  16-repository corpus: 33 files, 32 of which never run (17 test files no harness
  includes). See `docs/rules/no-orphan-file.md`.
- Export inventories of 112 submodules of Base, Core and the standard libraries
  (`Base.BinaryPlatforms`, `LinearAlgebra.BLAS`, …), and `data/public-only.json`: the
  names that are `public` but not exported, which `using` doesn't bring in.
- A test file that its harness includes by a computed path (a `readdir` loop,
  `include("$f.jl")`) sees the harness's top-level names. Computed `eval(ex)` at top level
  is treated like `@eval $(…)`.

### Changed

- `no-undef` is in `recommended`, as a warning. On a 16-repository corpus its findings go
  from 8,969 to 115 (`recommended`; `strict`, which also reports include fragments in full, 7,188).
- `no-undef` checks macro operands, including string interpolations in logging macros
  (`@info "… $hex …"`, the bug fixed by JuliaLang/Pkg.jl#4909), as the macro's signature
  describes them.
- `no-undef`'s `unknownModules: "ignore"` no longer silences the whole module: value reads
  inside function bodies of names an unresolved `using` can't plausibly export are still
  reported, with their own message (interpolated names at any length). New option value
  `"values"`.
- An unresolved `import M`/`import ..f` binds only the written name; only `using` can bring
  in unknown names. `..M` follows the parent module's `import M`.
- Package extensions (`ext/<Ext>/<Ext>.jl`) are include-tree entries. A module that
  includes files by a computed path or at run time is treated like one with an unresolved
  `using`.

## [0.2.0] - 2026-11-10

### Added

- 10 rules inspired by [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl):
  `no-debugger` (in `recommended` as a warning), `no-env-mutation`, `require-typed-global`,
  `prefer-typed-empty-array`, `no-show-macro`, `no-reassigned-capture`,
  `prefer-parenthesized-interpolation` (also in `style`), and the configurable policy rules
  `no-restricted-calls`, `no-restricted-macros` and `no-restricted-imports`, which ship
  with no entries. (#43)
- `docs/policies.md` and `docs/restricted-syntax.md`: project policies with the
  `no-restricted-*` rules and ESLint core `no-restricted-syntax` over Julia trees. (#43)
- An Influences section in the README. (#43)

### Changed

- `wasm/parser.wasm` rebuilt on [WasmCodegen.jl](https://github.com/gbaraldi/WasmCodegen.jl)
  main `98cad1f` (v0.1.0: `316bbaf`), with WasmBuilder.jl 0.1.1 and `wasm-opt -O3`
  (Binaryen 130). JuliaSyntax is unchanged: the one shipped in Julia 1.13.2 (also the one in
  1.13.3). The parser output is identical to v0.1.0's on 25,174 real-world Julia files, and
  parsing speed is the same within noise (0.156 → 0.159 s/MB). The module is 739,251 bytes
  (was 735,576). `wasm/manifest.json` also records the WasmBuilder and Binaryen versions.
  The build was first checked on WasmCodegen main in #45; this release ships it.
- README: the rule count is 76.

## [0.1.0] - 2026-11-08

First release, as a GitHub release (not on npm yet).

### Added

- ESLint language plugin for Julia (`julia/julia`), using ESLint's language API (ESLint 10,
  or 9.39+). Parses with JuliaSyntax from Julia 1.13.2, compiled to WebAssembly and bundled
  (no Julia installation needed); the binary's hash is verified at load time.
- 66 rules: likely bugs (`use-isnan`, `no-unsafe-finally`, `no-unreachable`,
  `no-duplicate-keyword-arguments`, …), scope rules (`no-undef`, `no-unused-vars`,
  `no-undefined-exports`, …) and performance and style advice.
- Presets: `recommended` (23 rules: likely bugs, near-zero false positives), `strict`
  (everything else as warnings), `style` and `all`, with the evidence for each default in
  `docs/defaults.md`.
- Scope analysis following Julia's scoping rules, and module resolution: literal
  `include` trees, `test/runtests.jl`, and the exports of `using`d stdlibs and packages
  (through `Manifest.toml` and the depot).
- `eslint-disable` directives in Julia comments, `--fix` and editor suggestions, a
  `recover` mode that lints files with syntax errors, and documentation links from every
  rule (`meta.docs.url`) so SARIF and editors link findings to rule pages.
- Usage guide (`docs/usage.md`): install from a release or git, CLI, GitHub Actions with
  annotations and code scanning, pre-commit hooks, and editors.

[Unreleased]: https://github.com/pankgeorg/eslint-plugin-julia/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/pankgeorg/eslint-plugin-julia/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pankgeorg/eslint-plugin-julia/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pankgeorg/eslint-plugin-julia/releases/tag/v0.1.0
