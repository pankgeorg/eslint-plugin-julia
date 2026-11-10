# Using eslint-plugin-julia

eslint-plugin-julia lints Julia code with [ESLint](https://eslint.org). It parses with
Julia's own parser (JuliaSyntax from Julia 1.13.2, compiled to WebAssembly and bundled),
so it needs Node.js but no Julia installation.

- [Requirements](#requirements)
- [Install](#install)
- [A Julia project without Node yet](#a-julia-project-without-node-yet)
- [Configure](#configure)
- [Run from the command line](#run-from-the-command-line)
- [GitHub Actions](#github-actions)
- [Pre-commit hooks](#pre-commit-hooks)
- [Editors](#editors)
- [Troubleshooting](#troubleshooting)

## Requirements

- Node.js 22 or 24 (tested on the latest 22.x and 24.x on Linux, macOS and Windows). The
  bundled parser uses WebAssembly GC and exception handling; the plugin checks this at
  startup and fails with a clear error on a runtime without them.
- ESLint 10 (or 9.39+, which passes the packaging smoke test).

## Install

The plugin is published as GitHub releases (not yet on npm). Install the release tarball:

```sh
npm install --save-dev eslint \
  https://github.com/pankgeorg/eslint-plugin-julia/releases/download/v0.2.0/eslint-plugin-julia-0.2.0.tgz
```

or the tagged commit from git:

```sh
npm install --save-dev eslint github:pankgeorg/eslint-plugin-julia#v0.2.0
```

Both pin an exact version in `package.json`. Nothing is built or downloaded during
installation: the parser binary is in the package and its hash is checked at load time.

## A Julia project without Node yet

Add three small files at the root of the Julia project (next to `Project.toml`):

`package.json`:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint '**/*.jl'"
  }
}
```

then run the install command above, which fills in `devDependencies` and creates
`package-lock.json` (commit both).

`eslint.config.js`:

```js
import julia from 'eslint-plugin-julia';

export default [julia.configs.recommended];
```

`.gitignore` (append):

```gitignore
node_modules/
```

`npm run lint` (or `npx eslint '**/*.jl'`) now lints every `.jl` file. ESLint skips
`node_modules/` by default.

## Configure

`eslint.config.js` is an ESLint [flat config](https://eslint.org/docs/latest/use/configure/).
The plugin provides four presets; each selects `**/*.jl` files and sets the Julia
language:

| preset                      | what it turns on                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `julia.configs.recommended` | Likely bugs with near-zero false positives (errors when Julia would reject the code or the check can never be right, warnings otherwise). Start here. |
| `julia.configs.strict`      | `recommended` plus every other rule as a warning: style, performance advice, and the scope rules (`no-undef`, `no-unused-vars`, …).                   |
| `julia.configs.style`       | Only the opt-in style rules, as warnings; combine with `recommended`.                                                                                 |
| `julia.configs.all`         | Every rule as an error (for exploring).                                                                                                               |

Which rule is in which preset, and the evidence for each default:
[defaults.md](defaults.md). Every rule has a page under [rules/](rules/).

Adjust individual rules after a preset:

```js
import julia from 'eslint-plugin-julia';

export default [
  { ignores: ['docs/build/**', 'test/fixtures/**'] },
  julia.configs.recommended,
  {
    files: ['**/*.jl'],
    rules: {
      'julia/no-unused-vars': 'warn',
      'julia/no-empty-catch': ['warn', { allowComment: true }],
    },
  },
  {
    // Tests define throwaway variables freely.
    files: ['test/**/*.jl'],
    rules: { 'julia/no-unused-vars': 'off' },
  },
];
```

Inline directives work in Julia comments:

```julia
# eslint-disable-next-line julia/no-empty-catch -- cleanup is best effort
try close(io) catch end
```

**Syntax errors.** By default a file that doesn't parse gets one fatal "parsing error" and
no rule runs on it. With `languageOptions: { recover: true }` the rules run on the
recovered tree and syntax errors become `julia/parse-errors` findings.

**Scope rules and your environment.** `no-undef`, `no-unused-vars` and
`no-undefined-exports` resolve `using`/`import` through `Manifest.toml` and the Julia
depot, to know which names a package exports. Instantiate the environment first
(`julia --project -e 'using Pkg; Pkg.instantiate()'`) and set `JULIA_DEPOT_PATH` if you
use a non-default depot; without it, names from packages are unknown and those rules
stay quiet about them. See [module-resolution.md](module-resolution.md).

**Markdown.** To lint ` ```julia ` code blocks in Markdown files, add ESLint's Markdown
plugin (`npm install --save-dev @eslint/markdown`):

```js
import julia from 'eslint-plugin-julia';
import markdown from '@eslint/markdown';

export default [
  julia.configs.recommended,
  { files: ['**/*.md'], plugins: { markdown }, processor: 'markdown/markdown' },
  // The processor names each code block after its info string: README.md/0.julia
  { ...julia.configs.recommended, files: ['**/*.md/*.julia', '**/*.md/*.jl'] },
];
```

**Project policies.** To ban calls, macros or imports in your project, configure
`julia/no-restricted-calls`, `julia/no-restricted-macros` and `julia/no-restricted-imports`
(they ship with no entries). For other syntax patterns, use ESLint's core
`no-restricted-syntax` with [selectors over Julia node kinds](restricted-syntax.md); the
[AST reference](ast.md) lists the node kinds. [policies.md](policies.md) has a worked
example config.

## Run from the command line

```sh
npx eslint '**/*.jl'                  # lint (quote the glob so ESLint expands it)
npx eslint src/MyPackage.jl           # one file
npx eslint '**/*.jl' --fix            # apply automatic fixes
npx eslint '**/*.jl' --max-warnings 0 # fail on warnings too
npx eslint --stdin --stdin-filename x.jl < x.jl
```

`--fix` applies only fixes that cannot change what the code does (for example `strict`'s
`no-redundant-type-assertion` turns `(x::Int)::Int` into `(x::Int)`). Many rules offer
_suggestions_ instead, which an editor shows as quick fixes for you to accept.

**SARIF** (for GitHub code scanning and other tools):

```sh
npm install --save-dev @microsoft/eslint-formatter-sarif
npx eslint '**/*.jl' --format @microsoft/eslint-formatter-sarif --output-file eslint-julia.sarif
```

Each result links to its rule's documentation.

## GitHub Actions

Copy to `.github/workflows/lint-julia.yml`:

```yaml
name: Lint Julia

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  eslint-julia:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write # for the SARIF upload below
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci

      # Optional: only needed for no-undef / no-unused-vars / no-undefined-exports, which
      # read Manifest.toml and the depot to know what `using SomePackage` brings in.
      # - uses: julia-actions/setup-julia@v3
      #   with:
      #     version: '1'
      # - run: julia --project=. -e 'using Pkg; Pkg.instantiate()'
      #   env:
      #     JULIA_PKG_PRECOMPILE_AUTO: '0'

      # Code scanning: findings appear in the Security tab and inline on pull requests.
      # Free for public repositories; private ones need GitHub Advanced Security.
      # Without it, delete these two steps (and the security-events permission).
      - run: npx eslint '**/*.jl' --format @microsoft/eslint-formatter-sarif --output-file eslint-julia.sarif || true
      - uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: eslint-julia.sarif
          category: eslint-julia

      # Fails the build on errors. setup-node's built-in problem matcher turns this
      # output into annotations on the pull request, in any repository.
      - run: npx eslint '**/*.jl'
```

This needs `@microsoft/eslint-formatter-sarif` in your `devDependencies` for the code
scanning steps. GitHub shows at most 10 annotations of each level per step; the full list
is in the log (and in code scanning).

## Pre-commit hooks

With [lint-staged](https://github.com/lint-staged/lint-staged), add to `package.json`
(and run it from your Git hook manager, e.g. `npx lint-staged` in `.husky/pre-commit`):

```json
{
  "lint-staged": {
    "*.jl": "eslint --fix"
  }
}
```

With [pre-commit](https://pre-commit.com), using the project's own `node_modules`:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: eslint-julia
        name: eslint (Julia)
        entry: npx --no-install eslint --fix
        language: system
        files: \.jl$
```

Both block the commit when ESLint reports an error, and commit the fixes `--fix` applied.

## Editors

VS Code with the [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
(and the Julia extension, which defines the `julia` language). In `.vscode/settings.json`:

```json
{
  "eslint.validate": ["julia"]
}
```

The extension uses the `eslint` from the project's `node_modules` and the flat config at
the workspace root. If findings don't appear, set `"eslint.runtime": "node"` so it runs on
your installed Node (22 or 24) rather than the editor's bundled one, and check the
"ESLint" output channel. The CLI is what the tests cover; editor integration is
expected to work through ESLint's standard language support but is not tested here.
Other editors with ESLint language-server support need the same: `julia` files routed to
ESLint, and a Node 22+ runtime.

## Troubleshooting

- **"Parsing error" on a file.** The file has a Julia syntax error (the message gives the
  position), or uses syntax newer than Julia 1.13. Use `recover: true` to lint the rest.
- **`no-undef` reports names from a package.** The environment isn't instantiated, or
  `JULIA_DEPOT_PATH` doesn't include the depot where the packages live.
- **"No files matching the pattern".** Quote the glob (`'**/*.jl'`) so the shell doesn't
  expand it, and check `ignores`.
- **Startup error about WebAssembly.** Node is older than 22; upgrade Node.
