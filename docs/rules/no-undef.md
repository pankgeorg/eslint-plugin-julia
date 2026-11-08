# julia/no-undef

Reports executable identifier reads without an ordinary Julia binding in the
containing module or an implicit Julia 1.13.2 Base/Core export. Opt-in (`all`),
with no edits. Literal includes, sibling files and known exports resolve through
[module resolution](../module-resolution.md).

```julia
using LinearAlgebra
norm([1, 2])       # resolved stdlib export
f(x) = x + offest  # offest is unresolved
@enum Shade light dark
light             # unknown macro-generated bindings do not count
@gensym a b       # documented exception: binds a and b
(a, b)
@isdefined(x)     # tests for a binding; x is not a value read
```

Options:

- `globals: []`: trust these project-wide names.
- `moduleExports: { M: ["x"] }`: supply exports for an unresolved wildcard module.
- `unknownModules: "ignore"` (default): suppress unknown reads only in the module
  with an unresolved bare using/import; any such name might be one of its exports.
  Known stdlibs and resolvable package/relative modules do not suppress typos.
  Set `"report"` to report despite unresolved modules. Explicitly configured
  `moduleExports` closes that module's fallback to the supplied names.
- `unknownGlobals: "ignore"`: suppress all unresolved reads (default `"report"`).

These options suppress reports and never invent macro bindings. Includes with
literal paths contribute ordinary module names, recursively and cycle-safely.
Computed or missing includes, eval and include_string contribute no new names;
use `globals` for dynamic APIs. `settings.julia.entryFiles` supplies nonpackage
entry points. Package `test/runtests.jl` is also an entry, so recursively
included tests share its imports and helpers. Files outside an entry's include tree retain standalone analysis.

Opaque macro operands themselves are skipped; written function bodies and
assignments still participate. An `@isdefined` argument is not a read. Quote
interpolation is executable; literal quoted names are data. Properties, keyword
labels, named-tuple keys and field declarations are excluded. Later local
assignments resolve earlier reads; initialization order belongs to
no-use-before-define. Module boundaries isolate the unknown-import fallback and
configured exports, so a using in one nested module cannot silence its sibling.

This is syntax analysis, not Julia execution. Missing manifests/installations,
ambiguous installed UUID matches and unsupported import paths retain the
unknown-module fallback. Macros, generated code, include ordering, eval effects
and runtime dispatch cannot be established. Exact spelling is used; Unicode
aliases and escaped var identifier equivalences are not normalized. See the
module-resolution documentation for depot lookup and ESLint cache limitations.
