# prefer-any

Suggests `any(predicate, xs)` for zero comparisons of two-argument `count` and for `isempty(filter(predicate, xs))`.

Existence tests can avoid counting every match or allocating a filtered collection.

## Options

None.

## Edits

Suggestions use Base.any (with negation for emptiness). No autofix: early stopping changes predicate effects, errors and stateful iterator consumption. Comments inside the replaced expression suppress the suggestion.

## Fallbacks and limitations

Only `> 0`, `!= 0`, `== 0` and their reversed comparisons are recognized. Length comparisons belong to prefer-isempty. Literal string, character and macro predicates, splats, keyword arguments and unknown helpers are skipped. Predicate and collection types are not inferred.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
count(isodd, xs) > 0          # Suggest Base.any(isodd, xs).
isempty(filter(isodd, xs))   # Suggest !Base.any(isodd, xs).
!isempty(filter(isodd, xs))  # Suggest Base.any(isodd, xs).
```

If negation is shadowed, emptiness diagnostics omit their replacement. Qualified Base suggestions also require Base to be available. Whitespace surrounding the expression and Unicode source coordinates are preserved.
