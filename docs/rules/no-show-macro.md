# no-show-macro

Report unshadowed `@show` and `@showtime`, including `Base.@show` and explicit Base
import aliases. Debug output can expose internals and clutter library output.
This rule is opt-in, analogous to ESLint's `no-console`: tests, examples and
scripts often use these macros deliberately. Restrict it to library sources:

```js
import julia from 'eslint-plugin-julia';
export default [{
  files: ['src/**'],
  plugins: { julia },
  language: 'julia/julia',
  rules: { 'julia/no-show-macro': ['warn', { allow: [] }] },
}];
```

`allow` defaults to `[]`. Entries name the canonical macros, with or without
`@`: `{ allow: ['showtime'] }` permits both `@showtime` and `Base.@showtime`.
Allowing `show` also permits an explicit alias imported from Base.

```julia
@show total                 # reported
Base.@showtime rebuild()    # reported
Other.@show total           # unrelated macro, skipped
```

For a whole statement with one expression, a suggestion removes the debugging
wrapper while preserving evaluation and its resulting value: `@show rebuild()`
becomes `(rebuild())`. No autofix is provided. Calls in assignments and other
value-consuming contexts, and multiple-argument `@show`, have no suggestion.
Removing the whole payload could discard important effects.

Quoted code and calls nested in other macro payloads are skipped. Local macro
definitions, shadowed namespaces and imports from unrelated modules are excluded.
Qualified macro namespaces resolve at module scope, so a runtime function
argument named `Base` does not shadow `Base.@show`. Macro expansion, computed module aliases and unresolved dependency exports cannot
be established from syntax; this rule does not execute macros.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "show"; ESLint analogue: `no-console`.
