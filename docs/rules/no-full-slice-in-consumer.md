# no-full-slice-in-consumer

Review `a[:]` immediately consumed by Base `length`, Base `sum`, or a normal `for` iterator when a single preceding local initializer establishes a Base Array. Ordinary array full slicing copies all elements in O(N) time and space.

```julia
function nitems()
    a = [1, 2, 3]
    length(a[:]) # Consider length(a).
end
```

There are no options. Literal vectors/matrices, builtin scalar typed literals and empty `Vector{T}()` are supported. Unknown receivers, rebindings, stored snapshots, assignment targets, macros, quoted code and shadowed consumers are excluded. This is limited lexical provenance, not alias or type inference.

A reviewed suggestion removes the slice only for `length`. No autofix is provided because allocation/failure timing changes. Sum and iteration receive advice without an edit: flattening can affect shape and reduction order, and the copy may intentionally protect iteration from mutation through aliases or callbacks. Use the original array, a view or `vec` only after reviewing those requirements, or retain the snapshot and disable this opt-in rule. Contiguous copying can also be beneficial; no speedup is guaranteed.
