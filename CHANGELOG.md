# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/pankgeorg/eslint-plugin-julia/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pankgeorg/eslint-plugin-julia/releases/tag/v0.1.0
