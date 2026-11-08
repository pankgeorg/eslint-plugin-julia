# no-empty-literal-range

Reports a loop or comprehension iterator whose literal integer range has a nonzero step directed away from its endpoint.

Julia ranges are inclusive, but `5:1` does not infer a descending step. Empty iteration can silently skip intended work.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

Only signed decimal integers within ±2147483647 are modeled, for platform-independent arithmetic. Dynamic endpoints, zero steps, hexadecimal literals and standalone empty range values are skipped. Deliberately empty test iterators remain possible.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
# Reported: the implicit step is +1.
for i in 5:1
    consume(i)
end

# Valid descending iteration.
for i in 5:-1:1
    consume(i)
end
```
