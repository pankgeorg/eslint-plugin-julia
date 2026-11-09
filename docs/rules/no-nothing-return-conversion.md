# no-nothing-return-conversion

Reports explicit bare or builtin-nothing returns, and obvious terminal nothing paths, in methods annotated with builtin Int, Int64, Float64, Bool or String.

Julia converts method results to the annotated return type. Converting nothing to these builtin types fails.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

The bounded flow model handles blocks, if/elseif/else and terminal loops; direct builtin throw/error stops a path. It accepts implicit final values and ignores unreachable statements after explicit exits. Empty method bodies (often interface placeholders), custom or union returns, try/finally, macros, ternaries and short-circuit expressions are skipped. Nested functions are analyzed separately. Unknown expressions and arbitrary nonreturning calls are not inferred. Infinite literal-true while loops without break are not treated as fallthrough. User-defined convert extensions can change stock builtin behavior.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
function value(ok)::Int
    if ok
        return 1
    end
    # Reported: the false branch implicitly produces nothing.
end

value(ok)::Int = ok ? 1 : 2  # Valid, and outside the bounded flow model.
```

Literal empty loops do not make their bodies reachable. A nonempty literal integer range whose body always returns or throws does not introduce a fallthrough path. Renamed type imports and general iterator cardinality are not inferred.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "return type annotation" (a policy against annotations); this rule reports only annotations that a `nothing` path cannot satisfy.
