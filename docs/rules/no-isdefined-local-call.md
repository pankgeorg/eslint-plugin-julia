# no-isdefined-local-call

Reports a resolved one-argument Core.isdefined call whose literal symbol names an existing lexical local or argument.

The function form requires an object/module and field. The macro `@isdefined(name)` tests a local without reading its value.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

Unknown symbols, globals, computed symbols, type parameters and correctly formed two-argument calls are excluded. This does not implement definite assignment and does not diagnose all invalid isdefined arities. No edit is supplied because macro availability and intended module lookup require review.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
f(x) = isdefined(:x)  # Reported: this is not a local-binding test.
f(x) = @isdefined(x)  # Valid.
isdefined(Main, :x)   # Valid module-global test.
```
