# julia/no-unused-vars

Reports local bindings with no resolved read. Assignments alone are not reads;
closure captures and identifiers written in macro arguments are reads. Module
variables, declaration names and type parameters are excluded. Explicit imported
names are checked across the resolved module include tree; exports/public API names
count as uses, as do method extensions of an imported function. Wildcard imports count as used if their module or an exported name
is read. Automatically imported wildcard members are never individually reported. Opt-in
(`all`), no edits: an initializer can have effects and arguments affect dispatch.

```julia
f(x) = (temporary = 1; x) # temporary is unused
f(x) = (y = x + 1; () -> y) # captured y is used
```

Options: `imports: "all"` (default) or `"none"` controls import checks.
`args: "none"` (default) or `"all"` includes positional and keyword
arguments; `ignoreKeywords: true` excludes keywords even with args all.
`caughtErrors: "none"` excludes catch variables (default all).
`ignorePattern: "^_"` exempts underscore-prefixed bindings; an invalid regex
suppresses the rule. `dynamicReads: "strict"` (default) counts only written reads;
`"ignore-containing-scope"` suppresses locals in scopes with macro/include/eval
operations. This fallback never synthesizes macro bindings or references.

Literal includes contribute module-wide import uses through
[module resolution](../module-resolution.md). Unknown wildcard exports, unresolved
includes and eval prevent proving an affected module import unused. These
conservative import fallbacks do not infer local reads. Quote names,
property names, keyword labels, named-tuple keys, field declarations and direct
macro option assignments after the first operand do not
count as reads. Unknown macro DSLs are treated conservatively: explicit identifiers
can count as uses, even if expansion treats them as data. Exact spellings only.
Intentional scaffolding and protocol arguments can need an underscore or option.
