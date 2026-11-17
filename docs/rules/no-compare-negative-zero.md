# no-compare-negative-zero

Reports scalar builtin `==` or `!=` with a literal negative floating zero, including
Float32. Ordinary numeric equality treats both zero signs alike, which can conceal
an intended sign check. Julia identity (`===`, `!==`) and `isequal` distinguish
floating zero signs and are allowed, as are ordering and broadcast comparisons.

No options. Only directly written decimal negative-zero literals are recognized;
computed values and underflow of nonzero literals are excluded. Shadowed equality
operators, opaque macros and quoted code are skipped. Generic-function resolution
does not prove the dispatched method for custom operands. Intentional equality
checks against both signs may be reported.

Offers `Base.isequal` (negated for `!=`) when the helper and negation are available
and no comment would be removed. No automatic fix: this changes signed-zero,
`missing` and potentially custom-type behavior and needs review. Unknown helper
availability falls back to a diagnostic without a suggestion.
