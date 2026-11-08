# no-debugger

Report interactive breakpoint macros left in checked-in source:

- Infiltrator: `@infiltrate`, `@exfiltrate`.
- Debugger: `@enter`, `@run`, `@bp`.

```js
import julia from 'eslint-plugin-julia';
export default [{
  files: ['**/*.jl'],
  plugins: { julia },
  language: 'julia/julia',
  rules: {
    'julia/no-debugger': ['warn', {
      checkImports: false,
      includeMacroPayloads: false,
    }],
  },
}, {
  files: ['src/**/*.jl'],
  rules: { 'julia/no-debugger': ['warn', { checkImports: true }] },
}];
```

Qualified invocations such as `Infiltrator.@infiltrate` match even without a written
import. Explicit imports and aliases establish the same origin. Bare names require
a matching import: an unrelated project-defined `@run` is not a debugger command.
As a documented fallback when package export information is unavailable, `using
Debugger` and `using Infiltrator` are treated as providing the listed macro names.
A local macro definition or an explicit import from another module takes precedence.
A local binding for the qualified namespace is also excluded. The fallback does
not apply to relative modules such as `using .Debugger` or bare `import Debugger`,
which does not bring its exports into scope.

A whole statement receives a suggestion to remove it. Expressions used as values
or inside another expression receive only a report. Comments inside a candidate
statement suppress the suggestion; trailing comments are preserved. There is no
autofix: removing a debugger statement is an explicit decision, and `@run`/`@enter`
may also execute the program being debugged.

Both options default to `false`:

- `checkImports` also reports imports of either package, including selective and
  renamed imports. Use a `src/**/*.jl` override if scripts legitimately import a
  debugger. Import statements have no removal suggestion.
- `includeMacroPayloads` inspects written invocations inside other macros.

Quoted code is always skipped. Macro expansions and dynamically introduced imports
are not analyzed. Provenance is syntactic and follows the shared origin matcher;
unknown aliases and ambiguous wildcard imports can be missed. There is no basename
heuristic for bare breakpoint macros without an import. Unknown option keys are rejected.

This rule is currently opt-in; its recommended-preset candidacy is reviewed separately.
For diagnostic output conventions, configure [no-restricted-macros](no-restricted-macros.md).

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "show" (related debugging policy); ESLint `no-debugger`.
