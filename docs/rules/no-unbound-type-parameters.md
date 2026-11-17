# julia/no-unbound-type-parameters

Reports method where parameters occurring in no positional argument type, directly
or through bounds of another live parameter. Keyword-only, return-type-only and
body-only uses do not bind positional dispatch parameters. Opt-in (`all`); no edits.

```julia
f(x) where T = x # unbound T
f(x::S) where {T,S<:AbstractVector{T}} = x # S binds T through its bound
```

Options: `ignoreParameters: []` exempts names. `checkKeywords: true` accepts a
keyword annotation as binding evidence (default false, matching dispatch policy).
`checkComplexSignatures: true` applies the syntactic occurrence test to positional
defaults and varargs; they are skipped by default. Callable-object signatures,
operator signatures, structs and dynamically constructed signatures are skipped.

This approximates Aqua's runtime unbound-argument check using written syntax. It
does not implement subtyping, arbitrary type functions, existential bindability or
macro expansion. Includes/eval/imports cannot create missing lexical dispatch
constraints; no external binding fallback is needed. Written methods inside macros
are checked; quotes are data. Exact spellings only; removing a parameter can change
method applicability, so there is no automatic repair.
