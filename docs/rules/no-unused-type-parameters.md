# julia/no-unused-type-parameters

Reports a method where parameter never referenced outside its own declaration and
bound. Argument types, return types, other parameters' bounds, body reads and
closure captures count. Opt-in (`all`); no edits.

```julia
f(x) where T = x # unused T
f(::Type{T}) where T = T # used
struct Tag{T} end # phantom parameter accepted by default
```

Options: `checkStructs: true` also checks struct/abstract/primitive type parameters
(default false); `ignoreParameters: []` exempts names.
`ignoreFunctionsWithDynamicCode: true` suppresses scopes containing macro/include/
eval operations (default false). Dynamic code never invents references or bindings.

A literal quoted T is data; an explicit macro-argument T counts conservatively as
use. Nested bindings can shadow the type parameter. Include/eval/bare using add no
inferred local uses. Intentional phantom parameters and runtime metaprogramming
can need an exemption. Standalone UnionAll/alias parameters are not checked.
Exact spellings only. Removing a binder can change applicability or expose other
names, so no automatic suggestion is offered.
