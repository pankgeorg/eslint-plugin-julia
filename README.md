# eslint-plugin-julia

Experimental v0.1 ESLint language plugin for Julia. It runs Julia 1.13.2's
JuliaSyntax parser as bundled WebAssembly, without a Julia installation. It uses
ESLint's native language API and Julia node kinds, with syntax-based rules.
It does not provide Julia name resolution, inference, or JavaScript core rules.

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

| Rule | Recommended | Edits |
| --- | --- | --- |
| [no-unused-expressions](docs/rules/no-unused-expressions.md) | Off | None |
| [parse-errors](docs/rules/parse-errors.md) | Error | None |
| [no-duplicate-struct-fields](docs/rules/no-duplicate-struct-fields.md) | Error | None |
| [no-duplicate-keyword-arguments](docs/rules/no-duplicate-keyword-arguments.md) | Error | None |
| [no-shadowed-loop-var](docs/rules/no-shadowed-loop-var.md) | Error | None |
| [prefer-identity-nothing](docs/rules/prefer-identity-nothing.md) | Off | Suggestions; autofix with `{ fix: true }` |
| [no-empty-catch](docs/rules/no-empty-catch.md) | Off | None |

Rules compare exact source spellings; Unicode normalization aliases can be missed.
Macros and quoted code are excluded from the non-parser rules. Rules cannot
predict macro expansion, dynamic splats, dispatch, or definitions in other files.

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
