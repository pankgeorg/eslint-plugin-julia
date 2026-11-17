# julia/no-duplicate-struct-fields

Recommended; no options or edits. Reports each repeated exact spelling among
direct field declarations in a struct's body. Handles bare names, `name::Type`,
and a single `const` wrapper (including mutable structs).

```julia
struct Bad
    α::Int
    α::Float64  # duplicate
end
struct Good
    x::Int
    y::Int
    Good(x, y) = new(x, y)
end
```

Skips constructors, function bodies, assignments, nested blocks, unrecognized
field shapes, macros, and quotes. Macro-generated declarations are not inspected.
Quoted identifiers (`var"x"`) and Unicode normalization aliases are not matched.
Native Julia 1.13.2 lowering rejects duplicate direct fields; evidence is in
`tests/fixtures/native-lowering.txt`. No field is removed automatically because
that would change the type's API.
