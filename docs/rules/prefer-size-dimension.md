# prefer-size-dimension

Suggest `size(x, d)` for an immediate Base `size(x)[d]` query with one positive integer literal index.

```julia
size(A)[2] # Consider size(A, 2).
```

A direct dimension query expresses the intent without constructing/indexing a size tuple. Julia may already optimize the tuple away; this is an opt-in idiom preference, not a demonstrated performance defect.

Assignment targets are excluded. There are no options. Slices, computed/nonpositive indices, tuple reuse, multiple size arguments, splats, keyword arguments, shadowed size, macro payloads and quoted code are excluded. No type or rank inference is attempted.

A reviewed suggestion uses `Base.size` when Base is available and replacement preserves comments. There is no autofix: for a vector `size(x)[2]` throws but `size(x, 2)` returns 1; dimension 1 also differs for a zero-dimensional array. Custom size methods can have different behavior. Keep tuple indexing when bounds validation is intended, review rank and method contracts before applying the suggestion, or disable the rule.
