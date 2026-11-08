# julia/prefer-isa

Suggests isa for typeof(x)==T, !=T and typeof(x)<:T. Identity comparisons are checked for known abstract types only; typeof(x)===Int remains a meaningful exact-type test. Opt-in (`all`). Suggestions only; no automatic fix. Replacements preserve outer trivia and are withheld when comments would be removed or Base is shadowed.

```julia
typeof(x) == Number # consider Base.isa(x, Number)
```

Options: exactTypes: false limits comparisons to known abstract types. abstractTypes: ["ProjectAbstract"] trusts additional names.

Exact concrete-type intent may be deliberate. Only a bare/qualified type name is supported. The abstract catalogue and same-file abstract declarations are syntactic evidence, not subtyping inference.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
