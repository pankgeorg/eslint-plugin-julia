# no-restricted-macros

Restrict configured written macro invocations. The default `entries: []` reports
nothing. Use this rule to express a project's concurrency, bounds-checking or
diagnostic conventions; it does not prove that the matched macro is unsafe.

```js
import julia from 'eslint-plugin-julia';
export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: {
      'julia/no-restricted-macros': [
        'warn',
        {
          entries: [
            { name: 'Base.@async', message: 'Use the project task launcher.' },
            {
              name: 'Threads.@threads',
              when: { argumentIndex: 0, argumentText: ':static' },
              message: 'Use the project loop scheduling convention.',
            },
          ],
          includeMacroPayloads: false,
        },
      ],
    },
  },
];
```

Each entry requires exactly one of `name` and `pattern`. Include the `@` in macro
names: `@show`, `Base.@inbounds`, `Threads.@threads`. The exact/glob semantics and
`binding: "resolved" | "spelling"` follow [no-restricted-calls](no-restricted-calls.md).
`*` and `?` match within one dotted segment. Undotted globs match the basename;
dotted globs match the full path. `message` supplies a project explanation.

In resolved mode, bare unshadowed `@async`, `Base.@async` and an explicitly renamed
import of `Base.@async` share an identity. A local macro or an import from another
module does not match that Base identity. `CUDA.@sync` is distinct from `Base.@sync`.
`Threads` normalizes to `Base.Threads`; explicit module aliases work too. An unknown
or ambiguous wildcard origin is skipped. Use spelling mode to deliberately restrict
a local or unresolved macro by its written name.

`when` limits a restriction to one written argument. `argumentIndex` is zero based;
`argumentText` must exactly equal that argument's source text, with outer trivia
removed and internal whitespace/comments preserved. Parentheses remain significant.
For example, `:static` matches the scheduler in `Threads.@threads :static for ...`,
while `:dynamic` and a missing scheduler do not. `when` requires both properties.
Each matching entry produces one report per invocation; overlapping entries can
therefore produce multiple reports.

Quoted code is always skipped. An outer macro itself can match by default, but
nested macro payloads are inspected only with `includeMacroPayloads: true`. This
never expands macros or analyzes generated code. Macro definitions are not
invocations, although written invocations in their executable bodies can match.
The rule does not follow arbitrary value aliases or recover original identities
through unresolved reexports. All option objects reject unknown properties.

There are no fixes or suggestions: changing scheduling, generation, bounds checks
or diagnostics can change results and execution order. See [Project policies](../policies.md).

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) checks "@cfunction", "@inbounds", "@threads", "@sync", "@async", "static threads", "@generated", "show".
