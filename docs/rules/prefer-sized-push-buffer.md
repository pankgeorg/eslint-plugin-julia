# prefer-sized-push-buffer

Suggest reserving capacity for an empty local Base vector immediately followed by a literal integer range loop with one unconditional `push!` per iteration.

```julia
out = Int[]
for i in 1:100
    push!(out, i)
end
# Consider sizehint!(out, 100) after initialization.
```

Base vectors already grow in amortized O(N) time. Reserving space can avoid capacity growth, element movement and temporary backing allocations; this rule does not claim a quadratic algorithm or a measured speedup.

Options: `minimumIterations` (positive integer, default `16`) sets the smallest reported trip count. Range counting supports descending and stepped signed integer literals, uses bounded integer arithmetic and never enumerates values.

The reviewed suggestion inserts `Base.sizehint!` after initialization when Base is available. It preserves element type but changes allocation and failure timing. No autofix is provided. Existing size hints, unknown trip counts, other buffer uses, aliases, reassignments, closures, macros, quoted code, conditional control flow, exits and nested loops are excluded. Typed literal vectors require a recognized builtin scalar type; empty `Vector{T}()` is also supported. No interprocedural escape or exception analysis is attempted. Cold code may gain nothing; leave the loop as written or disable this opt-in rule when reservation is unhelpful.
