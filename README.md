# eslint-plugin-julia

Experimental v0.1 ESLint language plugin for Julia. It runs Julia 1.13.2's
JuliaSyntax parser as bundled WebAssembly, without a Julia installation. It uses
ESLint's native language API and Julia node kinds, with syntax and scope rules.
It includes an optional syntactic scope analyzer with [module resolution](docs/module-resolution.md); it does not provide
Julia inference or JavaScript core rules.

Requires ESLint 10.14+ within major 10 and Node 22.23.3+ within major 22, or
24.22.1+ within major 24, with Wasm GC and exception handling enabled. Those two
baseline versions were tested on Linux arm64; other platforms await CI.

## Install from git

There is no npm release yet. Install from git and pin a reviewed commit:

```sh
npm install --save-dev eslint@^10.14.0 'git+https://github.com/pankgeorg/eslint-plugin-julia.git#COMMIT'
```

For a local checkout, use
`npm install --save-dev /path/to/eslint-plugin-julia`. No build or download runs
during installation. The package includes the Wasm binary and verifies its hash
at import. Run `npm test` in a checkout to verify the ABI and test suite.

## Flat config

```js
// eslint.config.js (ESM)
import julia from 'eslint-plugin-julia';

export default [
  julia.configs.recommended,
  {
    files: ['**/*.jl'],
    // Optional: lint recovered syntax during editing.
    languageOptions: { recover: true },
    rules: {
      'julia/prefer-identity-nothing': 'warn',
      'julia/no-empty-catch': ['warn', { allowComment: true }],
    },
  },
];
```

`recommended` selects `**/*.jl`, registers `julia`, and sets
`language: 'julia/julia'`. `style` selects the same files and enables the two
opt-in rules as warnings. `all` enables all registered rules as errors, retaining the
default suggestion-only identity behavior. These are single flat config objects.
For explicit registration, use `plugins: { julia }` and
`language: 'julia/julia'` in a matching files entry. Keep JavaScript rules in
separate entries that select JavaScript files.

```sh
npx eslint '**/*.jl'
npx eslint --stdin --stdin-filename example.jl
```

The default configuration (`recommended`: likely bugs, near-zero false positives; `strict`: everything else as warnings) and the evidence behind each rule's default: [docs/defaults.md](docs/defaults.md).

Adding a rule: put it in `src/rules/<name>.js` with `docs/rules/<name>.md` and `tests/rules/<name>.test.js`, then run `node scripts/gen-registry.mjs` (it regenerates the registry in `src/index.js`, `tests/run.js` and this table).

| Rule | Recommended | Edits |
| --- | --- | --- |
| [no-collapsible-if](docs/rules/no-collapsible-if.md) | Off (strict: warn) | Suggestions |
| [no-collect-before-range-iteration](docs/rules/no-collect-before-range-iteration.md) | Off (strict: warn) | Suggestions |
| [no-compare-negative-zero](docs/rules/no-compare-negative-zero.md) | Off (strict: warn) | Suggestions |
| [no-concat-growth-in-loop](docs/rules/no-concat-growth-in-loop.md) | Off (strict: warn) | None |
| [no-cond-assign](docs/rules/no-cond-assign.md) | Off (strict: warn) | Suggestions |
| [no-const-reassign](docs/rules/no-const-reassign.md) | Warn | None |
| [no-constant-condition](docs/rules/no-constant-condition.md) | Off (strict: warn) | None |
| [no-discarded-copy-result](docs/rules/no-discarded-copy-result.md) | Warn | None |
| [no-dupe-args](docs/rules/no-dupe-args.md) | Error | None |
| [no-dupe-elseif](docs/rules/no-dupe-elseif.md) | Warn | None |
| [no-duplicate-dict-keys](docs/rules/no-duplicate-dict-keys.md) | Warn | None |
| [no-duplicate-keyword-arguments](docs/rules/no-duplicate-keyword-arguments.md) | Error | None |
| [no-duplicate-logical-operands](docs/rules/no-duplicate-logical-operands.md) | Warn | Suggestions |
| [no-duplicate-method-signatures](docs/rules/no-duplicate-method-signatures.md) | Off (strict: warn) | None |
| [no-duplicate-struct-fields](docs/rules/no-duplicate-struct-fields.md) | Error | None |
| [no-empty-block](docs/rules/no-empty-block.md) | Off (strict: warn) | None |
| [no-empty-catch](docs/rules/no-empty-catch.md) | Off (strict: warn) | None |
| [no-empty-literal-range](docs/rules/no-empty-literal-range.md) | Off (strict: warn) | None |
| [no-env-mutation](docs/rules/no-env-mutation.md) | Off (strict: warn) | None |
| [no-eval-local-symbol](docs/rules/no-eval-local-symbol.md) | Off (strict: warn) | None |
| [no-fill-with-mutable](docs/rules/no-fill-with-mutable.md) | Warn | None |
| [no-full-slice-in-consumer](docs/rules/no-full-slice-in-consumer.md) | Off (strict: warn) | Suggestions |
| [no-identical-branches](docs/rules/no-identical-branches.md) | Off (strict: warn) | None |
| [no-import-assign](docs/rules/no-import-assign.md) | Error | None |
| [no-impossible-length-comparison](docs/rules/no-impossible-length-comparison.md) | Off (strict: warn) | None |
| [no-invalid-foreign-call-signature](docs/rules/no-invalid-foreign-call-signature.md) | Error | None |
| [no-isdefined-local-call](docs/rules/no-isdefined-local-call.md) | Error | None |
| [no-loss-of-float-integer-precision](docs/rules/no-loss-of-float-integer-precision.md) | Off (strict: warn) | None |
| [no-nothing-return-conversion](docs/rules/no-nothing-return-conversion.md) | Warn | None |
| [no-obvious-type-piracy](docs/rules/no-obvious-type-piracy.md) | Off (strict: warn) | None |
| [no-overwritten-literal-index](docs/rules/no-overwritten-literal-index.md) | Off (strict: warn) | None |
| [no-redundant-type-assertion](docs/rules/no-redundant-type-assertion.md) | Off (strict: warn) | Fix |
| [no-redundant-union-members](docs/rules/no-redundant-union-members.md) | Off (strict: warn) | Suggestions |
| [no-restricted-imports](docs/rules/no-restricted-imports.md) | Off (strict: warn) | None |
| [no-self-assign](docs/rules/no-self-assign.md) | Warn | None |
| [no-self-identity-comparison](docs/rules/no-self-identity-comparison.md) | Off (strict: warn) | None |
| [no-shadowed-loop-var](docs/rules/no-shadowed-loop-var.md) | Warn | None |
| [no-single-iteration-loop](docs/rules/no-single-iteration-loop.md) | Off (strict: warn) | None |
| [no-string-growth-in-loop](docs/rules/no-string-growth-in-loop.md) | Off (strict: warn) | None |
| [no-throw-literal](docs/rules/no-throw-literal.md) | Off (strict: warn) | Suggestions |
| [no-unbound-type-parameters](docs/rules/no-unbound-type-parameters.md) | Off (strict: warn) | None |
| [no-undef](docs/rules/no-undef.md) | Off (strict: warn) | None |
| [no-undefined-exports](docs/rules/no-undefined-exports.md) | Off (strict: warn) | None |
| [no-uninitialized-ref-read](docs/rules/no-uninitialized-ref-read.md) | Error | None |
| [no-unreachable](docs/rules/no-unreachable.md) | Error | None |
| [no-unsafe-finally](docs/rules/no-unsafe-finally.md) | Error | None |
| [no-unsafe-negation](docs/rules/no-unsafe-negation.md) | Warn | Suggestions |
| [no-unused-expressions](docs/rules/no-unused-expressions.md) | Warn | None |
| [no-unused-type-parameters](docs/rules/no-unused-type-parameters.md) | Off (strict: warn) | None |
| [no-unused-vars](docs/rules/no-unused-vars.md) | Off (strict: warn) | None |
| [no-use-before-define](docs/rules/no-use-before-define.md) | Off (strict: warn) | None |
| [no-useless-assignment](docs/rules/no-useless-assignment.md) | Off (strict: warn) | Suggestions |
| [no-useless-catch](docs/rules/no-useless-catch.md) | Off (strict: warn) | None |
| [parse-errors](docs/rules/parse-errors.md) | Error | None |
| [prefer-any](docs/rules/prefer-any.md) | Off (strict: warn) | Suggestions |
| [prefer-const-global](docs/rules/prefer-const-global.md) | Off (strict: warn) | Suggestions |
| [prefer-count-over-findall-length](docs/rules/prefer-count-over-findall-length.md) | Off (strict: warn) | Suggestions |
| [prefer-eachindex](docs/rules/prefer-eachindex.md) | Off (strict: warn) | Suggestions |
| [prefer-extreme-over-sort](docs/rules/prefer-extreme-over-sort.md) | Off (strict: warn) | Suggestions |
| [prefer-generator-sum](docs/rules/prefer-generator-sum.md) | Off (strict: warn) | Suggestions |
| [prefer-identity-nothing](docs/rules/prefer-identity-nothing.md) | Off (strict: warn) | Fix + suggestions |
| [prefer-in](docs/rules/prefer-in.md) | Off (strict: warn) | Suggestions |
| [prefer-isa](docs/rules/prefer-isa.md) | Off (strict: warn) | Suggestions |
| [prefer-isempty](docs/rules/prefer-isempty.md) | Off (strict: warn) | Suggestions |
| [prefer-ismissing](docs/rules/prefer-ismissing.md) | Error | Suggestions |
| [prefer-size-dimension](docs/rules/prefer-size-dimension.md) | Off (strict: warn) | Suggestions |
| [prefer-sized-push-buffer](docs/rules/prefer-sized-push-buffer.md) | Off (strict: warn) | Suggestions |
| [prefer-typed-empty-array](docs/rules/prefer-typed-empty-array.md) | Off (strict: warn) | None |
| [require-typed-global](docs/rules/require-typed-global.md) | Off (strict: warn) | None |
| [use-isnan](docs/rules/use-isnan.md) | Error | Suggestions |

Rules compare exact source spellings; Unicode normalization aliases can be missed.
Macros and quoted code are excluded from the five non-parser rules. Rules cannot
predict macro expansion, dynamic splats, dispatch, or dynamic definitions. The scope analyzer resolves literal includes and known module exports.

## Syntax errors and directives

`languageOptions.recover` defaults to `false`: all JuliaSyntax errors become fatal
per-file parsing problems and ESLint skips rules on that file. They cannot be
suppressed with inline directives. With `recover: true`, ESLint visits the
recovered tree and `julia/parse-errors` reports the errors as suppressible rule
messages. Disabling that rule hides those messages, but retains diagnostics on
SourceCode. A shared guard removes fixes and suggestions from every plugin rule
on files with syntax errors, even when parse-errors is disabled. Third-party
rules must implement the same policy for their own edits.

A Wasm runtime trap produces a fatal per-file problem even in recovery mode; the
next parse gets a fresh instance. Adapter invariant violations throw as plugin
bugs. A hash mismatch or unsupported Wasm runtime fails plugin initialization.

Julia comments support `eslint-disable`, `eslint-enable`, `eslint-disable-line`,
`eslint-disable-next-line`, and inline `eslint` rule configuration, including
block comments and `-- justification` text:

```julia
# eslint-disable-next-line julia/no-empty-catch -- deliberately ignored
try f(); catch; end
```

AST locations and fixes use UTF-16; ESLint renders columns starting at 1. See the
[AST contract v1](docs/ast.md), [build provenance](scripts/build-parser.md), and
[ecosystem validation](ECOSYSTEM.md).

## Relation to other Julia tools

Formatting remains with topiary-julia, Runic, or JuliaFormatter. This plugin
checks narrow syntax patterns and offers no whitespace rules. JET.jl performs
Julia program analysis using inference; this plugin does not replace that work.
The Julia language server provides editor language features and Julia-specific
analysis. ESLint supplies configuration, suppressions, CLI reports, suggestions,
and optional integrations; editor activation still needs testing.

The CI template is staged in `RELAY/.github/workflows/ci.yml` for the owner to
move into `.github/workflows/`. It tests Node 22/24 on Linux/macOS/Windows. Its
optional SARIF demonstration intentionally reports findings in the fixtures and
requires GitHub code scanning permissions. No CI upload has been performed here.

MIT © Panagiotis Georgakopoulos. Bundled parser/compiler notices are in
`wasm/LICENSES/`; the Wasm compiler's exact revision is recorded in the manifest.
