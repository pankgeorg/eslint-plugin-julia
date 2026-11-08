# julia/no-dupe-args

Reports the later occurrence of a repeated named argument in one method, macro,
anonymous function or do signature. Positional/keyword arguments, nested
destructuring, defaults, annotations and splats share one name set. All-underscore
arguments and unnamed typed arguments are exempt. Recommended; no options or edits.

```julia
f(x; x=1) = x # duplicate x
f(_, _) = 1   # allowed write-only arguments
```

Calls are not signatures. Different methods and nested functions are independent.
Quoted code is data; written ordinary definitions in macro arguments are checked.
Macro-generated arguments cannot be discovered, and arbitrary argument DSLs are
not inferred. The written @nospecialize/@specialize argument wrappers are supported.
Include/eval/using exports cannot change written signature duplicates, so they
need no fallback option. Exact spellings only; normalized aliases can be missed.
Repeated names usually fail during Julia lowering even though parsing succeeds.
