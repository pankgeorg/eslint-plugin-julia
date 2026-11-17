# prefer-generator-sum

Review a Base `sum` whose sole argument is an untyped, one-dimensional comprehension with one iteration clause and no filter.

```julia
sum([f(x) for x in xs]) # Consider sum((f(x) for x in xs)).
```

Materializing mapped values typically retains O(N) intermediate storage. A generator can stream them with constant-size iterator state, excluding storage inside the mapping function or accumulator. Both generally do O(N) work, and compiler optimization may already eliminate allocation.

There are no options. The suggestion replaces the comprehension with a parenthesized generator. It is deliberately reviewed, never automatic: Array sums may use pairwise/SIMD reduction, while generators can change floating-point association, promotion, empty-input behavior and effect timing. It is not guaranteed faster or bit-identical. Keep materialization when those properties matter, consider another reduction API after review, or disable this opt-in rule.

Typed, filtered, nested and multidimensional comprehensions, stored arrays, keywords, splats, broadcast calls, shadowed sum, macros and quoted code are excluded. Suggestions are suppressed when comments would be removed. The rule does not infer result types, purity, collection size or runtime hotness.
