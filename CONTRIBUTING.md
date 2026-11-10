# Contributing

## Setup

You need Node.js 22 or 24. Julia is only needed to rebuild the parser or regenerate test
references.

```sh
git clone https://github.com/pankgeorg/eslint-plugin-julia
cd eslint-plugin-julia
npm ci
```

| command              | what it does                                                                     |
| -------------------- | -------------------------------------------------------------------------------- |
| `npm test`           | verifies the parser artifact, then runs every test (rules, parser, scope, CLI)   |
| `npm run lint`       | ESLint on the repo: JavaScript, and the repo's own Julia scripts with the plugin |
| `npm run format`     | Prettier, writing changes (`npm run format:check` only checks)                   |
| `npm run smoke:pack` | packs the tarball, installs it in a scratch project and lints through the CLI    |

CI runs all of these: lint and format on Node 24; tests on Linux, macOS and Windows with
Node 22 and 24; the packaging smoke test with ESLint 10 and 9.

The formatting commit is listed in `.git-blame-ignore-revs`. To use it:
`git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## Layout

- `src/language.js`, `src/source-code.js`: the ESLint language (parsing, comments, directives).
- `src/parser/`: the Wasm host and the conversion of JuliaSyntax's green tree to the AST
  ([docs/ast.md](docs/ast.md)).
- `src/scope.js`, `src/module-resolution.js`: scope analysis and `include`/`using` resolution.
- `src/rules/`: one file per rule; `*-common.js` files are shared helpers.
- `data/`: the names Base and Core export, and each stdlib's exports (`scripts/stdlib-exports.jl` regenerates the latter).
- `wasm/`: the parser binary, its manifest and the licence notices of what it contains.
- `tests/`: RuleTester suites per rule, parser tests against native JuliaSyntax output,
  scope tests, and CLI integration tests. `tests/fixtures/` holds inputs with deliberate
  findings.

## Adding a rule

1. Write `src/rules/<name>.js`. Use `defineRule` from `src/rules/common.js`: it drops fixes
   and suggestions on files with syntax errors. Use `getScopeManager` from `src/scope.js`
   for bindings, and check `isUnshadowedBuiltin` before treating a name as Base's.
2. Write `tests/rules/<name>.test.js` with RuleTester: at least three invalid and two valid
   cases, plus edge cases (macros, quoted code, shadowed builtins, Unicode).
3. Write `docs/rules/<name>.md`: what it reports and why, options, examples, limits.
4. Run `node scripts/gen-registry.mjs`. It regenerates `src/index.js`, `tests/run.js` and
   the README rules table; don't edit those by hand.
5. A new rule is opt-in (in `strict`). To propose it for `recommended`, measure it first:
   `node scripts/measure-rule.mjs <rule> <file-list> [project dirs]` lints real code with
   only that rule on. `recommended` is for likely bugs with near-zero false positives;
   record the evidence in `docs/defaults.md` and add it to `RECOMMENDED` in
   `scripts/gen-registry.mjs`.

`node scripts/inspect-tree.mjs 'julia code'` prints the AST for a snippet.

## The parser (`wasm/parser.wasm`)

The parser is Julia 1.13.2's JuliaSyntax, compiled to WebAssembly (GC and exception
handling) by [WasmCodegen.jl](https://github.com/gbaraldi/WasmCodegen.jl) at main commit
`98cad1f` (WasmBuilder.jl 0.1.1), then optimized with `wasm-opt -O3`. The entry points are in
`scripts/parser.jl`, and `scripts/build-parser.jl` builds it. Both come from
topiary-julia's `jlparse/` directory. The module has no imports and exports a small
numeric ABI (17 functions, listed in `wasm/manifest.json`). The host uploads the source,
calls `parse_src`, and reads back the green tree and diagnostics.

v0.2.0 rebuilt it on WasmCodegen main (v0.1.0 shipped a `316bbaf` build). The new build gives
the same green trees and diagnostics as the old one on 25,174 real-world Julia files and parses
at the same speed (0.16 s/MB); see `scripts/build-parser.md`.

To rebuild it, follow [scripts/build-parser.md](scripts/build-parser.md). Then:

- replace `wasm/parser.wasm`;
- update `wasm/manifest.json` (hash, size, versions);
- run `npm test`. `scripts/verify-artifact.mjs` checks the hash, size, exports and a smoke
  parse, and the parser tests compare trees with native JuliaSyntax output.

Installing the package never builds anything.

## Releasing

1. Update `version` in `package.json` and add the section to `CHANGELOG.md`.
2. Run `node scripts/gen-registry.mjs`: rule documentation links point at the version tag.
3. Merge to `main` with CI green.
4. Tag the merge, `git tag v<version> && git push origin v<version>`.
5. Run `npm pack`, then `gh release create v<version> eslint-plugin-julia-<version>.tgz`
   with the changelog section as notes.

The package is not published to npm yet.

## Commits and pull requests

Keep one logical change per commit, with tests. CI must be green before merging.
