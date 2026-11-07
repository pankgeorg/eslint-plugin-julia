# julia/no-duplicate-method-signatures

Reports later unconditional methods of one same-file module binding with identical supported positional signatures. Argument names, return annotations and keyword differences do not distinguish dispatch. Opt-in (`all`). No edits.

```julia
f(x::Int)=x
f(y::Int)=2y # overwrites the positional method
```

Options: allowRedefinition: true disables the check for interactive/redefinition scripts.

Supports fixed arity, untyped/Any arguments and known simple type identities. Skips where, defaults, varargs, conditional/macro definitions, constructors, qualified function names and dynamic/imported type expressions. Runtime aliases and method intersections are not inferred. No fix is offered.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
