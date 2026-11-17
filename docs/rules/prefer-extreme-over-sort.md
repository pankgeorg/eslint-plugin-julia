# prefer-extreme-over-sort

Review default Base `sort(v)[1]` or `sort(v)[end]` for integer vectors, and consider `minimum(v)` or `maximum(v)`.

```julia
sort([3, 1, 2])[1] # Consider minimum([3, 1, 2]).
f(v::Vector{Int}) = sort(v)[end] # Consider maximum(v).
```

Sorting retains an ordered copy when only one value is consumed. An extremum scan avoids that result storage and rearrangement. Julia may use adaptive or radix integer sorting, so this rule does not promise an asymptotic speedup.

Assignment targets are excluded. There are no options. Supported provenance is a nonempty integer vector literal, a nonempty Base `Int[...]` literal, a single preceding local initializer of either form, or an unrebound argument explicitly typed Base `Vector{Int}`. Slices, arbitrary vectors, floats/NaN/missing, custom or shadowed types/callees, sort!, keywords (`by`, `lt`, `rev`, etc.), splats, macros and quoted code are excluded. Float extrema and default sorting differ in their NaN handling; this rule does not infer their equivalence.

A reviewed suggestion uses `Base.minimum`/`Base.maximum` if Base is available and comments are preserved. There is no autofix. A typed argument or mutated local may be empty: indexing a sorted empty vector and taking its extremum throw different exceptions. Custom methods, allocation/error timing and intentional sort workloads also need review. Keep sorting, handle emptiness explicitly, or disable this opt-in rule as appropriate. Lexical provenance does not establish runtime hotness or absence of mutation.
