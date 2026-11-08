# eslint-plugin-julia

[![CI](https://github.com/pankgeorg/eslint-plugin-julia/actions/workflows/ci.yml/badge.svg)](https://github.com/pankgeorg/eslint-plugin-julia/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/pankgeorg/eslint-plugin-julia)](https://github.com/pankgeorg/eslint-plugin-julia/releases)
[![License: MIT](https://img.shields.io/github/license/pankgeorg/eslint-plugin-julia)](LICENSE)

Lint Julia code with [ESLint](https://eslint.org).

- **Julia's own parser.** JuliaSyntax from Julia 1.13.2, compiled to WebAssembly and
  bundled. It parses exactly what Julia parses, and needs no Julia installation, only
  Node.js.
- **66 rules** for likely bugs (`x == NaN`, a `return` inside `finally`, duplicate
  keyword arguments, unreachable code, …), scope problems (undefined and unused names,
  with `include` and `using` resolved through your Manifest) and performance pitfalls.
  A conservative `recommended` preset, and `strict` for everything.
- **Everything ESLint has:** `--fix` and editor suggestions, `eslint-disable` comments in
  Julia, flat config, SARIF for GitHub code scanning, caching, and pre-commit hooks.

```console
$ npx eslint '**/*.jl'

src/stats.jl
  12:8  error  Use isnan to test for NaN; equality and identity have different NaN semantics  julia/use-isnan
```

## Quick start

```sh
npm install --save-dev eslint \
  https://github.com/pankgeorg/eslint-plugin-julia/releases/download/v0.1.0/eslint-plugin-julia-0.1.0.tgz
```

```js
// eslint.config.js
import julia from 'eslint-plugin-julia';

export default [julia.configs.recommended];
```

```sh
npx eslint '**/*.jl'
```

Requires Node.js 22 or 24 and ESLint 10 (or 9.39+). **[docs/usage.md](docs/usage.md)**
covers the rest:

- setting this up in a Julia project that has no `package.json` yet;
- configuration, `--fix` and SARIF;
- a copy-paste **GitHub Actions** workflow (annotations and code scanning);
- pre-commit hooks;
- VS Code.

## Presets

| preset                      | what it turns on                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `julia.configs.recommended` | Likely bugs with near-zero false positives: errors when Julia rejects the code or the check can never be right, else warnings. |
| `julia.configs.strict`      | `recommended` plus every other rule as a warning (style, performance, scope rules such as `no-undef`).                         |
| `julia.configs.style`       | The opt-in style rules only, as warnings; combine with `recommended`.                                                          |
| `julia.configs.all`         | Every rule as an error.                                                                                                        |

Why each rule has its default, with false-positive counts on 2,518 real Julia files,
Pluto.jl and Malt.jl: [docs/defaults.md](docs/defaults.md).

## Rules

"Recommended" is the rule's level in `recommended`. "Edits": _Fix_ means `--fix` applies it,
and _Suggestions_ are quick fixes offered in editors.

| Rule                                                                                   | Recommended        | Edits             |
| -------------------------------------------------------------------------------------- | ------------------ | ----------------- |
| [no-collapsible-if](docs/rules/no-collapsible-if.md)                                   | Off (strict: warn) | Suggestions       |
| [no-collect-before-range-iteration](docs/rules/no-collect-before-range-iteration.md)   | Off (strict: warn) | Suggestions       |
| [no-compare-negative-zero](docs/rules/no-compare-negative-zero.md)                     | Off (strict: warn) | Suggestions       |
| [no-concat-growth-in-loop](docs/rules/no-concat-growth-in-loop.md)                     | Off (strict: warn) | None              |
| [no-cond-assign](docs/rules/no-cond-assign.md)                                         | Off (strict: warn) | Suggestions       |
| [no-const-reassign](docs/rules/no-const-reassign.md)                                   | Warn               | None              |
| [no-constant-condition](docs/rules/no-constant-condition.md)                           | Off (strict: warn) | None              |
| [no-discarded-copy-result](docs/rules/no-discarded-copy-result.md)                     | Warn               | None              |
| [no-dupe-args](docs/rules/no-dupe-args.md)                                             | Error              | None              |
| [no-dupe-elseif](docs/rules/no-dupe-elseif.md)                                         | Warn               | None              |
| [no-duplicate-dict-keys](docs/rules/no-duplicate-dict-keys.md)                         | Warn               | None              |
| [no-duplicate-keyword-arguments](docs/rules/no-duplicate-keyword-arguments.md)         | Error              | None              |
| [no-duplicate-logical-operands](docs/rules/no-duplicate-logical-operands.md)           | Warn               | Suggestions       |
| [no-duplicate-method-signatures](docs/rules/no-duplicate-method-signatures.md)         | Off (strict: warn) | None              |
| [no-duplicate-struct-fields](docs/rules/no-duplicate-struct-fields.md)                 | Error              | None              |
| [no-empty-block](docs/rules/no-empty-block.md)                                         | Off (strict: warn) | None              |
| [no-empty-catch](docs/rules/no-empty-catch.md)                                         | Off (strict: warn) | None              |
| [no-empty-literal-range](docs/rules/no-empty-literal-range.md)                         | Off (strict: warn) | None              |
| [no-eval-local-symbol](docs/rules/no-eval-local-symbol.md)                             | Off (strict: warn) | None              |
| [no-fill-with-mutable](docs/rules/no-fill-with-mutable.md)                             | Warn               | None              |
| [no-full-slice-in-consumer](docs/rules/no-full-slice-in-consumer.md)                   | Off (strict: warn) | Suggestions       |
| [no-identical-branches](docs/rules/no-identical-branches.md)                           | Off (strict: warn) | None              |
| [no-import-assign](docs/rules/no-import-assign.md)                                     | Error              | None              |
| [no-impossible-length-comparison](docs/rules/no-impossible-length-comparison.md)       | Off (strict: warn) | None              |
| [no-invalid-foreign-call-signature](docs/rules/no-invalid-foreign-call-signature.md)   | Error              | None              |
| [no-isdefined-local-call](docs/rules/no-isdefined-local-call.md)                       | Error              | None              |
| [no-loss-of-float-integer-precision](docs/rules/no-loss-of-float-integer-precision.md) | Off (strict: warn) | None              |
| [no-nothing-return-conversion](docs/rules/no-nothing-return-conversion.md)             | Warn               | None              |
| [no-obvious-type-piracy](docs/rules/no-obvious-type-piracy.md)                         | Off (strict: warn) | None              |
| [no-overwritten-literal-index](docs/rules/no-overwritten-literal-index.md)             | Off (strict: warn) | None              |
| [no-redundant-type-assertion](docs/rules/no-redundant-type-assertion.md)               | Off (strict: warn) | Fix               |
| [no-redundant-union-members](docs/rules/no-redundant-union-members.md)                 | Off (strict: warn) | Suggestions       |
| [no-self-assign](docs/rules/no-self-assign.md)                                         | Warn               | None              |
| [no-self-identity-comparison](docs/rules/no-self-identity-comparison.md)               | Off (strict: warn) | None              |
| [no-shadowed-loop-var](docs/rules/no-shadowed-loop-var.md)                             | Warn               | None              |
| [no-single-iteration-loop](docs/rules/no-single-iteration-loop.md)                     | Off (strict: warn) | None              |
| [no-string-growth-in-loop](docs/rules/no-string-growth-in-loop.md)                     | Off (strict: warn) | None              |
| [no-throw-literal](docs/rules/no-throw-literal.md)                                     | Off (strict: warn) | Suggestions       |
| [no-unbound-type-parameters](docs/rules/no-unbound-type-parameters.md)                 | Off (strict: warn) | None              |
| [no-undef](docs/rules/no-undef.md)                                                     | Off (strict: warn) | None              |
| [no-undefined-exports](docs/rules/no-undefined-exports.md)                             | Off (strict: warn) | None              |
| [no-uninitialized-ref-read](docs/rules/no-uninitialized-ref-read.md)                   | Error              | None              |
| [no-unreachable](docs/rules/no-unreachable.md)                                         | Error              | None              |
| [no-unsafe-finally](docs/rules/no-unsafe-finally.md)                                   | Error              | None              |
| [no-unsafe-negation](docs/rules/no-unsafe-negation.md)                                 | Warn               | Suggestions       |
| [no-unused-expressions](docs/rules/no-unused-expressions.md)                           | Warn               | None              |
| [no-unused-type-parameters](docs/rules/no-unused-type-parameters.md)                   | Off (strict: warn) | None              |
| [no-unused-vars](docs/rules/no-unused-vars.md)                                         | Off (strict: warn) | None              |
| [no-use-before-define](docs/rules/no-use-before-define.md)                             | Off (strict: warn) | None              |
| [no-useless-assignment](docs/rules/no-useless-assignment.md)                           | Off (strict: warn) | Suggestions       |
| [no-useless-catch](docs/rules/no-useless-catch.md)                                     | Off (strict: warn) | None              |
| [parse-errors](docs/rules/parse-errors.md)                                             | Error              | None              |
| [prefer-any](docs/rules/prefer-any.md)                                                 | Off (strict: warn) | Suggestions       |
| [prefer-const-global](docs/rules/prefer-const-global.md)                               | Off (strict: warn) | Suggestions       |
| [prefer-count-over-findall-length](docs/rules/prefer-count-over-findall-length.md)     | Off (strict: warn) | Suggestions       |
| [prefer-eachindex](docs/rules/prefer-eachindex.md)                                     | Off (strict: warn) | Suggestions       |
| [prefer-extreme-over-sort](docs/rules/prefer-extreme-over-sort.md)                     | Off (strict: warn) | Suggestions       |
| [prefer-generator-sum](docs/rules/prefer-generator-sum.md)                             | Off (strict: warn) | Suggestions       |
| [prefer-identity-nothing](docs/rules/prefer-identity-nothing.md)                       | Off (strict: warn) | Fix + suggestions |
| [prefer-in](docs/rules/prefer-in.md)                                                   | Off (strict: warn) | Suggestions       |
| [prefer-isa](docs/rules/prefer-isa.md)                                                 | Off (strict: warn) | Suggestions       |
| [prefer-isempty](docs/rules/prefer-isempty.md)                                         | Off (strict: warn) | Suggestions       |
| [prefer-ismissing](docs/rules/prefer-ismissing.md)                                     | Error              | Suggestions       |
| [prefer-size-dimension](docs/rules/prefer-size-dimension.md)                           | Off (strict: warn) | Suggestions       |
| [prefer-sized-push-buffer](docs/rules/prefer-sized-push-buffer.md)                     | Off (strict: warn) | Suggestions       |
| [use-isnan](docs/rules/use-isnan.md)                                                   | Error              | Suggestions       |

Rules work on syntax and scope. They don't expand macros or infer types, so they skip
code inside macros they don't know and never guess at dispatch. Each rule's page lists
its limits.

## How it fits with other Julia tools

- **Formatting:** use Runic.jl, JuliaFormatter.jl or topiary-julia. This plugin has no
  whitespace rules.
- **JET.jl** finds errors through type inference, by loading your code in Julia. This
  plugin needs no Julia process: it checks syntax and scope, a different class of mistakes,
  and the two complement each other.
- **The Julia language server** (VS Code) provides editor intelligence and its own lint.
  This plugin brings ESLint's ecosystem to Julia: configuration, CI reports, SARIF and
  pre-commit.

## More

- [docs/usage.md](docs/usage.md): install, configure, CLI, GitHub Actions, hooks, editors.
- [docs/defaults.md](docs/defaults.md): presets and the evidence behind them.
- [docs/module-resolution.md](docs/module-resolution.md): how `include`/`using` are resolved.
- [docs/ast.md](docs/ast.md): the Julia AST for writing your own rules or selectors.
- [CONTRIBUTING.md](CONTRIBUTING.md): development, tests, adding a rule, rebuilding the parser.
- [CHANGELOG.md](CHANGELOG.md).

## License

MIT © Panagiotis Georgakopoulos. The bundled parser includes code from Julia and
JuliaSyntax (MIT) and was compiled with WasmCodegen.jl (MIT); their notices are in
[wasm/LICENSES/](wasm/LICENSES/).
