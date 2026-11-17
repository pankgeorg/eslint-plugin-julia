# no-uninitialized-ref-read

Reports immediate `Ref{T}()[]` reads for resolved builtin String, Any and Function element types.

These reference-stored elements are uninitialized and reading them throws UndefRefError.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

Allocation alone is safe and is not reported. Local-variable flows, C out parameters, indexed access with explicit indices, custom types and bits types are excluded. Ref{Int}() has undetermined bits, which is a different concern. Assignment targets are writes and are skipped.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
Ref{String}()[]          # Reported: UndefRefError.
Ref{String}("ready")[]   # Valid initialized read.
Ref{Int}()[]             # Outside this rule's reference-storage subset.
r = Ref{String}()        # Valid allocation; initialization may follow.
```

Ordinary, typed, and destructuring assignment targets are writes, so they are skipped. The rule does not propose an arbitrary initial value.
