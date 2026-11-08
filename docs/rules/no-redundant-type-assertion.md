# no-redundant-type-assertion

Reports nested expression assertions with the same stable named type, for example
`(x::Int)::Int`. The inner assertion already returns that value or throws.

No options. Supports a conservative builtin type catalogue and identical immutable
type-parameter bindings. Shadowed names, computed types, local aliases and unknown
origins are skipped. It does not infer types, simplify subtypes or check ordinary
argument/return annotations. Declaration and assignment targets are excluded
because they can invoke conversion. Opaque macros and quoted code are excluded.

Automatically removes only the outer assertion when its suffix contains no
comments. With comments it reports without a fix. This is a cleanup check; it does
not diagnose a runtime correctness defect.
