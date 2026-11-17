# no-overwritten-literal-index

Reports the first of two immediately adjacent stores to the same in-bounds literal index, immediately after a fresh local integer vector literal allocation.

The second store replaces the first value before any read or escape can observe it.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

Only an ordinary function outer body with a single vector binding definition is supported. Captures, branch/exception regions, macros, typed vectors, generic indexing, conversions, aliases, nondecimal integers and out-of-bounds indices are skipped. All values fit a 32-bit signed integer. No general alias or dead-store analysis is attempted.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
function example()
    a = [0, 0]
    a[1] = 1  # Reported: this value is never observed.
    a[1] = 2
    return a
end
```

The detector intentionally requires allocation and both stores to be consecutive. Intervening reads, aliases, calls, or assignments prevent a report.
