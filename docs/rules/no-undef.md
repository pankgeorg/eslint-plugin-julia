# julia/no-undef

Reports executable identifier reads without an ordinary Julia binding in the
containing module or an implicit Julia 1.13.2 Base/Core export. Opt-in (`all`),
with no edits. Literal includes, sibling files and known exports resolve through
[module resolution](../module-resolution.md).

```julia
using LinearAlgebra
norm([1, 2])       # resolved stdlib export
f(x) = x + offest  # offest is unresolved
function download(url)
    @info "downloading $url ($hex)"  # hex is unresolved: macro operands are reads
end
@enum Shade light dark
light             # @enum defines Shade, light and dark (macro signature table)
@gensym a b       # binds a and b
(a, b)
@isdefined(x)     # tests for a binding; x is not a value read
@bind x 1        # Pluto's @bind initializes global x
x
```

Options:

- `globals: []`: trust these project-wide names.
- `moduleExports: { M: ["x"] }`: supply exports for an unresolved wildcard module.
- `unknownModules: "ignore"` (default): in a module with an unresolved `using M`
  (or an `include` of a computed path, or run inside a function or block), a name
  that M could plausibly export is not reported. Still reported, with the message
  "it could only come from the unresolved `using M`": a read inside a function,
  `do` block or closure body, in a position where only values appear (a string
  interpolation, an arithmetic or comparison operand, a condition, an index, a
  range endpoint, a `for` iterable), of a name that starts with a lowercase ASCII
  letter, is at least 3 characters long, and is never used unresolved in the
  module the way imported names are (as a call, type, receiver, or in `export`).
  `"values"` also reports such names as call arguments. `"report"` reports every
  unresolved read. Known stdlibs, their submodules, resolvable packages (installed,
  or through the [environment resolver](../environment-resolver.md)) and relative
  modules never suppress anything. Only `using` can bring in unknown names: an
  unresolved `import M` or `import ..f` binds just the written name. Explicitly
  configured `moduleExports` closes that module's fallback to the supplied names.
- `unknownGlobals: "ignore"`: suppress all unresolved reads (default `"report"`).

These options suppress reports and never invent bindings. Includes with
literal paths contribute ordinary module names, recursively and cycle-safely.
Computed or run-time includes mark the module as above; missing literal includes,
eval and include_string contribute no new names;
use `globals` for dynamic APIs. `settings.julia.entryFiles` supplies nonpackage
entry points. Package `test/runtests.jl` is also an entry, so recursively
included tests share its imports and helpers. Files outside an entry's include tree retain standalone analysis.

Macro operands are reads as the macro's signature describes them; see
[macros](../macros.md) for the built-in table, the rule for unknown macros, and
`settings.julia.macros`. An `@isdefined` argument is not a read. Quote
interpolation is executable; literal quoted names are data. Properties, keyword
labels, named-tuple keys and field declarations are excluded. Later local
assignments resolve earlier reads; initialization order belongs to
no-use-before-define. Module boundaries isolate the unknown-import fallback and
configured exports, so a using in one nested module cannot silence its sibling.

This is syntax analysis, not Julia execution. Missing manifests/installations,
ambiguous installed UUID matches and unsupported import paths retain the
unknown-module fallback. Macro expansions, generated code, include ordering, eval
effects and runtime dispatch cannot be established. Exact spelling is used; Unicode
aliases and escaped var identifier equivalences are not normalized. See the
module-resolution documentation for depot lookup and ESLint cache limitations.
