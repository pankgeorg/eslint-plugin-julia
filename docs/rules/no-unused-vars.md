# julia/no-unused-vars

Reports local bindings with no resolved read. Assignments alone are not reads;
closure captures and identifiers written in macro arguments are reads. Module
bindings, declaration names, imports, and type parameters are excluded. Opt-in
(`all`), no edits: an initializer can have effects and arguments affect dispatch.

```julia
f(x) = (temporary = 1; x) # temporary is unused
f(x) = (y = x + 1; () -> y) # captured y is used
```

Options: `args: "none"` (default) or `"all"` includes positional and keyword
arguments; `ignoreKeywords: true` excludes keywords even with args all.
`caughtErrors: "none"` excludes catch variables (default all).
`ignorePattern: "^_"` exempts underscore-prefixed bindings; an invalid regex
suppresses the rule. `dynamicReads: "strict"` (default) counts only written reads;
`"ignore-containing-scope"` suppresses locals in scopes with macro/include/eval
operations. This fallback never synthesizes macro bindings or references.

Bare using and included/evaluated code add no inferred local uses. Quote names,
property names, keyword labels, named-tuple keys and field declarations do not
count as reads. Unknown macro DSLs are treated conservatively: explicit identifiers
can count as uses, even if expansion treats them as data. Exact spellings only.
Intentional scaffolding and protocol arguments can need an underscore or option.
