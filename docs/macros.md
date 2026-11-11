# Macros in scope analysis

Macros are never expanded. The scope pass decides from the macro's **signature** which of
its arguments are reads, which define names, and which are generated code or symbols. Rules
that check names (`no-undef`) use that decision; the other rules keep treating macro
arguments conservatively, as before.

## The default: arguments are reads

Every name in a macro call's arguments is a read, including string interpolations
(`@info "downloading $url ($hex)"`) and keyword values (`@warn "x" value=v`). It must be
defined like any other read. The exceptions:

- `$x` inside quoted code (`:(…)`, `quote … end`) and in `@eval` code reads `x`; every
  other name in that code is generated code, not a read.
- Quoted symbols (`:name`) are data.
- Macros not in the table (below) may declare names (`@variables x y`,
  `@variable(m, x >= 0)`). A name in a **head position** of their arguments is a read when
  something else defines it; otherwise it is taken to be the macro's binding, in the
  enclosing function (or module), so later reads of the name aren't reported either. Head
  positions: a bare name argument; the left side of `=`; `x::T`; `x(t)`; `x[1:3]` (and an
  index iterator `i = 1:n`); operands of a top-level comparison (`0 <= x <= 1`); the left
  side of `~` (`x ~ Normal()`); the left side of `=>` directly in a `begin` block (pattern
  arms); the same inside a `begin` block argument. Call arguments, interpolations and
  keyword values of unknown macros are still reads, except a bare name (or a tuple of
  names) as the value of a top-level option (`infer=no`, `trainable=(a, b)`), which is
  treated like a head position. An unknown macro used as a statement in a function with at
  least two arguments, all names or types and one of them capitalized
  (`@OnDemandTableauExtract Tab T`), may define locals: that function's unresolved reads
  aren't reported.
- `seriestype --> :path` and `xguide := "x"` (plot recipes) name attributes: their left
  side is not a read anywhere.
- Smaller syntax rules: `@simd ivdep` is a flag; `@test_throws UndefVarError expr` expects
  `expr` to be undefined; reads guarded by `@isdefined(x) && …` or `if @isdefined(x)` are
  not reported; a documented signature without a definition (`"doc" f(x)`) is not code;
  a plot recipe (`@recipe`) reads the `plotattributes` it is given (the `inject` field).

## Signatures

A signature is `{ args?, rest?, last?, kw?, scope?, binding?, form? }`: `args[i]` is the
role of the i-th argument, `last` the role of the final one, `rest` the role of the others,
and `kw` the role of the value of a `name = value` argument after the first (`name` is a
symbol). A string is shorthand for `{ rest: role }`.

| Role      | Meaning                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `expr`    | Ordinary code: names are reads; written assignments, loops and functions define names as usual.       |
| `bind`    | A declaration: head-position names (above) are defined in `scope`; everything else is read.           |
| `maybe`   | Like `bind`, but a name only becomes a binding when nothing else defines it (the unknown-macro rule). |
| `quote`   | Generated code: only `$x` interpolations are reads. Definitions written in it are kept.               |
| `fields`  | Field lists (`a::T`): `a` is a symbol, `T` is read.                                                   |
| `pattern` | A MacroTools-style pattern: `x_`, `xs__`, `x_T` bind `x`/`xs`; other names are symbols.               |
| `symbol`  | A name, not a variable (`@goto label`).                                                               |
| `skip`    | Not analyzed.                                                                                         |

`scope` is `enclosing` (the enclosing function or module; default), `global` (the module),
or `inner` (the last `begin`/`for` argument gets a scope of its own, as `@testset` does).
`binding: "assignment"` makes `bind` names ordinary assignments in the current scope.
`form` selects a handler for shapes roles can't express: `eval` (`@eval [module] code`),
`kwdef` (field defaults may read earlier fields), `ccall` (`@ccall lib.f(x::Cint)::Cint`:
`f` is a C symbol; `lib`, arguments and types are read), `deprecate` (`@deprecate old(x)
new(x)`: `old` is defined globally, only `new` is read), `doc` (a documented method
signature is not code), `plottype` (`@userplot MarginalHist` and `@shorthands cdensity`
define `marginalhist`/`marginalhist!` and `cdensity`/`cdensity!`) and `accessor` (`@handle
msg.mousedown begin … end`: `mousedown` is a variable of the body).

The built-in table (`src/macro-signatures.js`) covers:

- logging, `@test*` and BenchmarkTools macros (`expr`, with keywords); `@test_skip`,
  `@test_broken`, `@test x skip=…`/`broken=…` and `@macroexpand` (`skip`: not run as
  written);
- `@assert`, `@show`, `@time` and the other timing and introspection macros, and the
  pass-through macros (`@inbounds`, `@views`, `@inline`, `@simd`, `@threads`, `@spawn`,
  `@sync`, `@static`, `@atomic`, `@generated`, `@reexport`, …) (`expr`);
- `@testset` (`expr`, inner scope); `@eval`, `@kwdef`/`@with_kw`, `@ccall`, `@deprecate`,
  `@doc` (forms);
- `@enum`, `@cenum` (`bind`, global); `@gensym`, Pluto's `@bind` (assignments);
- `@unpack`, `@variables`, `@parameters`, `@constants`, `@syms`, `@named`, `@mtkbuild`
  (`bind`); `@capture` (`pattern`); index notation (`@tensor`, `@tullio`, `@einsum`,
  `@cast`: `skip`); Markdown's `@breaking`/`@trigger` (`decorator`); `@NamedTuple`, `@Kwargs` (`fields`); `@goto`, `@label`
  (`symbol`); Base.Cartesian's `@nloops`, `@nref`, … (`skip`);
- plot types: RecipesBase's `@recipe function …` (reads `plotattributes`), Makie's
  `@recipe Violin (x, y) begin … end` (defines `violin`, `violin!`), `@userplot`,
  `@shorthands` (`plottype`);
- package macros seen in the wild: WGLMakie's `@handle` (`accessor`), SymbolicUtils'
  `@number_methods` and Symbolics' `@num_method` (templates over placeholder names:
  `skip`), JET's `@analyze_toplevel` (code to analyze: `skip`).

Macros are matched by name, without their module (`Base.@kwdef` is `@kwdef`).

## Your own macros

`settings.julia.macros` adds signatures or replaces built-in ones:

```js
settings: {
  julia: {
    macros: {
      '@mylog': 'expr', // every argument is a read
      '@declare': { rest: 'bind' }, // `@declare a b` defines a and b
      '@register': { args: ['symbol', 'expr'] },
      '@model': { args: ['symbol'], last: 'quote' },
    },
  },
}
```

## Limits

Signatures describe arguments, not expansions: names a macro injects into code around it
(other than through its arguments), definitions generated from computed names, and
context-dependent nesting (`@series` inside `@recipe`) are not modeled. Package-specific
DSLs beyond the table may need entries in `settings.julia.macros`.
