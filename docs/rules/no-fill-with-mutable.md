# julia/no-fill-with-mutable

Reports fill of fresh mutable array literals, basic typed literals, Dict/Ref, or zeros/ones allocations when slots may share one object. Literal zero/one-slot shapes are excluded. Opt-in (`all`). No edits.

```julia
fill([], n) # every slot shares the same array
```

Options: unknownDimensions: false requires literal dimensions proving at least two slots. Default true follows the task’s fill([],n) policy.

Sharing can be intentional, and unknown n can be zero or one. No heap analysis, aliases or arbitrary constructors are followed; no fix is offered.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
