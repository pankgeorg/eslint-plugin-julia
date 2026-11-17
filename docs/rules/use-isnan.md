# julia/use-isnan

Reports scalar ==, !=, === and !== comparisons with known NaN/NaN32/NaN16 in either order. Identity comparisons are included per the task, although they can be intentional. Opt-in (`all`). Suggestions only; no automatic fix. Replacements preserve outer trivia and are withheld when comments would be removed or Base is shadowed.

```julia
x == NaN # consider Base.isnan(x)
```

Options: identity: false excludes ===/!==.

Suggestions change behavior deliberately; IEEE probes, missing propagation and custom equality/identity intent require review.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
