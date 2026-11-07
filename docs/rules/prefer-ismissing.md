# julia/prefer-ismissing

Reports scalar ==/!= comparisons with known missing in either order. All value contexts are checked by default per the task. Opt-in (`all`). Suggestions only; no automatic fix. Replacements preserve outer trivia and are withheld when comments would be removed or Base is shadowed.

```julia
x == missing # consider Base.ismissing(x)
```

Options: onlyConditions: true limits checks to if/elseif/while/ternary conditions and non-final &&/|| operands.

Equality propagates missing; testing absence changes that propagation. Identity and broadcast comparisons are excluded.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
