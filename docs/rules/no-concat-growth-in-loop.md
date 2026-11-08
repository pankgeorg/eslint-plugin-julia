# no-concat-growth-in-loop

Review `a = vcat(a, chunk)` or `a = hcat(a, chunk)` in a loop immediately preceded by an empty local Base Array initializer (`[]`, builtin scalar `T[]`, `Vector{T}()`, or literal-dimension `zeros` with a zero dimension).

```julia
a = Int[]
for chunk in chunks
    a = vcat(a, chunk)
end
```

Each ordinary Array concatenation copies the previous prefix. Fixed-size appended blocks can cause quadratic element movement; geometric block growth can instead give total copying proportional to final size. No runtime speedup is guaranteed.

There are no options or edits. Consider sized indexed block writes, collecting blocks and concatenating once, or `append!` for compatible vectors. Mutation changes alias behavior; concatenation may promote element types whereas append converts into the destination type. `hcat` has shape requirements. Empty inputs and result shape need review before selecting a replacement; retain deliberate copies or disable this opt-in rule.

The rule requires two positional arguments, builtin callee resolution and the same local binding as target and first argument. Only adjacent initialization, straight-line `for`/`while` bodies and recurrence-only writes/reads are recognized. Unknown initial arrays, resets, intermediate observations, closure capture, conditional control flow, nested loops, macros, quoted code, splats and keywords are excluded. Bracket concatenation forms are not matched. This lexical analysis cannot infer effects or custom dispatch in arbitrary calls.
