# no-impossible-length-comparison

Reports scalar builtin comparisons whose result follows from the nonnegative
`length` contract: `length(xs) < 0`, `length(xs) >= 0`, and comparisons against
negative integer literals, including reversed forms. It leaves emptiness tests
such as `length(xs) == 0` to `prefer-isempty`.

The option `{ knownCollectionsOnly: true }` limits checks to direct tuple, vector
and string expressions; it defaults to `false`. No type inference is performed.
Custom methods violating the length contract and deliberate defensive checks can
be reported. Shadowed builtins, chains, broadcasts, splats, keyword-only or type-applied calls, computed bounds, opaque macros
and quoted code are skipped. Unknown origins are skipped.

No fix or suggestion: replacing the expression with a constant can discard
collection evaluation or exceptions and cannot recover the intended bound.
