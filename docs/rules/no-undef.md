# julia/no-undef

Reports executable identifier reads without an ordinary Julia binding in the
containing module or an implicit Julia 1.13.2 Base/Core export. In `recommended`
as a warning, with no edits. Literal includes, sibling files and known exports resolve through
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
  letter, is at least 3 characters long (any length when interpolated: `"$v!"`
  reads `v!`), and is never used unresolved in the
  module the way imported names are (as a call, type, receiver, or in `export`).
  `"values"` also reports such names as call arguments. `"report"` reports every
  unresolved read. Known stdlibs, their submodules, resolvable packages (installed,
  or through the [environment resolver](../environment-resolver.md)) and relative
  modules never suppress anything. Only `using` can bring in unknown names: an
  unresolved `import M` or `import ..f` binds just the written name. Explicitly
  configured `moduleExports` closes that module's fallback to the supplied names.
- `unknownGlobals: "ignore"`: suppress all unresolved reads (default `"report"`).
- `fragments: "narrow"` (default): an include fragment (below) gets the narrowed
  check above, with the message "it could only come from the file that includes
  this one". `"report"` reports every unresolved read in a fragment, with that
  same lower-confidence message, and also reads that only a macro binds (whether a
  fragment's macros exist is as unknown as its includer); `strict` uses it.

These options suppress reports and never invent bindings. Includes with
literal paths contribute ordinary module names, recursively and cycle-safely.
Computed or run-time includes mark the module as above; missing literal includes,
computed `eval` and `include_string` contribute no new names (literal code,
`eval(:(const lib = …))` at top level, defines its names like `@eval`);
use `globals` for dynamic APIs. `settings.julia.entryFiles` supplies nonpackage
entry points. Package `test/runtests.jl` is also an entry, as are harness scripts
in the file's directory or above it, up to the package or repository root
(`runtests.jl`, Documenter's `make.jl`/`makedocs.jl`), so included tests and docs
helpers share their imports and helpers.

A file that no entry reaches is an include fragment when its context lies
elsewhere: a package file that doesn't import the package itself, a test file
(under `test/` or `tests/`) that doesn't `using` the package itself, and a file
with no imports and no modules inside an environment that has a harness (a docs
snippet). A
fragment is assumed to run after its harness's top level (the nearest
`runtests.jl`/`make.jl`/`makedocs.jl` above it) and, outside `src/`, after
`using Package` (when the file's environment can load it); what's still
unresolved gets the narrowed check (see
`fragments`). A test file that loads its package itself, or a script that imports
it, keeps the full check.

Generated definitions under a literal prefix (`fname = Symbol(:get_, prop)` then
`@eval $fname(sys) = …`) leave only names with that prefix unknown, in the module and
in modules that import from it, instead of every name. A generated
`using M: <names(M; all = true)>` imports M's own definitions (not the names M itself
imports). Where `@recipe` isn't available in a module whose names are all known,
`markersize --> 50` is an ordinary call and `markersize` a read; likewise a plot type
declared with an unavailable `@userplot` defines nothing.

`@eval M code` runs in `M` (looked up from the module enclosing the `@eval`): a
read there, except inside a `$` interpolation, resolves against every name `M`
defines (not only its exports) when `M` is the package, a dependency or a
submodule whose names can all be listed; otherwise it gets the narrowed check,
with a message naming `M`.

Macro operands are reads as the macro's signature describes them; see
[macros](../macros.md) for the built-in table, the rule for unknown macros, and
`settings.julia.macros`. An `@isdefined` argument is not a read, and code guarded by an `@isdefined` test (`if @isdefined(M) … end`, `@isdefined(x) && …`) isn't checked: it runs only where more names exist. Quote
interpolation is executable; literal quoted names are data. Properties, keyword
labels, named-tuple keys and field declarations are excluded. Later local
assignments resolve earlier reads; initialization order belongs to
no-use-before-define. Module boundaries isolate the unknown-import fallback and
configured exports, so a using in one nested module cannot silence its sibling.

`using M` brings in the names `M` exports, not the ones it only declares `public`
(`Base.OneTo`, `Base.Fix1`): those need qualification or `using M: name`. A module that
evaluates computed code at top level (`eval(make_def(op))`, `@eval $(…)`) gets the narrowed
check. A test file that its harness includes by a computed path (`for f in readdir(@__DIR__)
include(f) end`, `include("$name.jl")`) sees the harness's top-level names, at fragment
confidence, even if it imports its package itself.

This is syntax analysis, not Julia execution. Missing manifests/installations,
ambiguous installed UUID matches and unsupported import paths retain the
unknown-module fallback. Macro expansions, generated code, include ordering, eval
effects and runtime dispatch cannot be established. Exact spelling is used; Unicode
aliases and escaped var identifier equivalences are not normalized. See the
module-resolution documentation for depot lookup and ESLint cache limitations.
