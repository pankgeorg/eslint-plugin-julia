# no-invalid-foreign-call-signature

Reports fixed-arity ccall calls whose literal type tuple length differs from the number of supplied values, and recognized Base.@ccall arguments missing ::CType.

These forms parse, but fail during lowering or macro expansion. Values passed to the ordinary ccall function do not themselves need type annotations.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

Varargs, splats, keyword ccall forms and nonliteral type tuples are skipped. Only the builtin @ccall macro is inspected; enclosing macros and quotes remain opaque. This does not validate C signatures, argument types, ABI layouts, return annotations or every malformed macro form. No edit can safely choose the missing type or value.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
ccall(:abs, Cint, (Cint,))     # Reported: one type, no values.
ccall(:abs, Cint, (Cint,), x)  # Valid: x needs no inline annotation.
Base.@ccall abs(x)::Cint      # Reported: x needs ::Cint.
Base.@ccall abs(x::Cint)::Cint # Valid.
```
