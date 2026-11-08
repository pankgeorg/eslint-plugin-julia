# no-restricted-imports

Enforce a project's written module boundaries and import style. This syntax policy is off until configured; empty options report nothing.

```js
import julia from 'eslint-plugin-julia';

export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: {
      'julia/no-restricted-imports': [
        'warn',
        {
          entries: [
            {
              module: 'LegacyAPI',
              names: ['launch'],
              kind: 'both',
              message: 'Use the supported launcher.',
            },
          ],
          banImport: false,
          requireExplicitNames: true,
          allowBareUsing: ['Test'],
          includeMacroPayloads: false,
        },
      ],
    },
  },
];
```

`entries` defaults to `[]`; each entry requires exactly one of `module` or `modulePattern`, and a nonempty `message`. `kind` defaults to `both`. Omit `names` to restrict every clause for that module; otherwise provide a nonempty list of original names, before `as`. Thus a restriction on `launch` matches `using LegacyAPI: launch as start`, but not `using LegacyAPI: safe as launch`. Macro names include `@`; quoted identifiers use their identifier contents. Bare `using LegacyAPI` does not enumerate exports and cannot match a name-only restriction. The `names` filter applies to colon lists; a dotted bare import such as `import LegacyAPI.launch` is treated as a whole path because syntax alone cannot distinguish a submodule from a value. Restrict that complete path separately if needed.

Module paths retain leading relative dots: `LegacyAPI`, `.LegacyAPI`, and `..LegacyAPI` are distinct. Spacing between path components is insignificant. `modulePattern` is anchored against the entire written module path: `*` matches zero or more non-dot characters, `?` one non-dot character, and all other characters are literal. `LegacyAPI.*` matches one child module, not deeper descendants. No filesystem or package resolution is used, so local modules, aliases, and builtin module spellings follow the same policy.

`banImport` (default `false`) reports each import statement. `requireExplicitNames` (default `false`) reports bare using clauses, including relative ones; `using ..Parent: x` already supplies an explicit list and is accepted. `allowBareUsing` (default `[]`) exempts exact module paths from that requirement only, for example `Test` in a tests override. It does not bypass restricted entries. Each entry reports at most once per statement even if several names or clauses match; independent policies can each report.

Quotes are always skipped. Macro payloads are skipped unless `includeMacroPayloads` is true. Macro expansion, eval-generated imports, exported names of bare using, and canonical identities behind aliases are outside this rule. No fix is offered: changing import kind can change method-extension semantics.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "no import", "bare using", "no import RAICode"; ESLint `no-restricted-imports`.
