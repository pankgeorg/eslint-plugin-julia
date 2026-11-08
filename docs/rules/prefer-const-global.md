# julia/prefer-const-global

Suggests const for a direct, unconditional module/file variable assignment when
it is assigned exactly once in this file and read inside a function body.
Signature-only references are excluded; they have separate evaluation rules. Imported,
already const, typed and declaration-name bindings are excluded. Opt-in (`all`);
suggestion only, requiring review of external rebindings.

```julia
threshold=10
f(x)=x>threshold # suggest const threshold=10
```

Options: `dynamicScopes: "skip"` (default) skips modules containing bare using or
macro/include/eval operations; `"strict-file"` checks written evidence anyway.
`mutableGlobals: []` exempts externally rebound globals. `initializers: "literals"`
limits suggestions to literals, noninterpolated strings and literal
vectors/tuples; `"all"` (default) permits other initializers.

Object mutation does not rebind a name. Explicit global writes inside functions
count as rebindings. Includes/eval/bare using and other files supply no inferred
writes; macro expansion never supplies bindings. Written macro assignments are
excluded. Single-file evidence cannot prove session-wide const safety. A type
annotation may be preferable for intentionally mutable globals. Exact spellings
only; no automatic fix or inference of Julia types.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "non-const untyped global"; for globals that are deliberately reassigned, see `require-typed-global`.
