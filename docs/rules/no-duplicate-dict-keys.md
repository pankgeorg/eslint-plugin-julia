# no-duplicate-dict-keys

Reports later duplicate literal keys in resolved builtin `Dict` calls, for example
`Dict(:mode => 1, :mode => 2)`. The later value replaces the earlier value, often
hiding a mistaken key.

No options. Only homogeneous symbol or noninterpolated string keys are supported.
Typed constructors must specify the matching builtin `Symbol` or `String` key type.
Every entry must be an explicit builtin `=>` pair. Numeric keys, conversions,
splats, mixed kinds, triple strings and unsupported escapes are skipped. Common
escapes and Unicode escapes are decoded; non-ASCII byte escapes are skipped.
Shadowed builtins, opaque macros and quoted code are excluded. Unresolved origins
are skipped; this is not runtime key-equality analysis.

No fix or suggestion: deleting an entry can discard value evaluation or exceptions,
and the intended replacement key is unknown. Intentional literal overlays can be
reported; review the duplicate before editing.
