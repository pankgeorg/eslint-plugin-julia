# prefer-count-over-findall-length

Suggest `count(predicate, xs)` for immediate `length(findall(predicate, xs))` when both consumers resolve to Base and the predicate is a lambda or recognized builtin predicate.

```julia
length(findall(isodd, xs)) # Consider count(isodd, xs).
```

Both generally inspect N entries. `findall` retains K matching indices and some Array implementations also construct a Boolean mask; counting avoids retaining those intermediates. This is allocation advice, not an improved generic traversal bound.

There are no options. The builtin predicate set is `isodd`, `iseven`, `iszero`, `isone`, `isnothing`, `ismissing`, `isnan`, `isfinite`, `isinf`, `isempty`, `identity`, `isletter`, `isdigit`, `isspace`, and `isascii`. Unknown predicate bindings, regex/pattern overloads, one-argument findall, stored match lists, keywords, splats, shadowed builtins, macro payloads and quoted code are excluded.

A reviewed suggestion uses qualified `Base.count` when Base is available and no comments would be removed. There is no autofix: custom collections, specialized methods, predicate effects and error timing may differ. Keep `findall` when indices are needed, review behavior before applying the suggestion, or disable this opt-in rule. No interprocedural method or type inference is attempted.
