# no-redundant-union-members

Reports repeated stable named builtin types or the same type-parameter binding in
builtin `Union{...}`. For example, `Union{Int, Int}` represents the same type as
`Union{Int}` and can hide a forgotten alternative.

No options. A conservative catalogue of builtin types is recognized, including
Base/Core qualification and explicit builtin imports. Unknown types, local type
aliases, computed members and composite type expressions are skipped. The rule
does not simplify subtypes or equivalent aliases (`Int` versus `Int64`). Opaque
macros, quoted code and shadowed `Union` or type names are excluded.

Offers a suggestion to remove each repeated member when no comment is removed.
No automatic fix: review which alternative was intended. This is redundancy
analysis, not evidence that the resulting Union causes a runtime bug.
