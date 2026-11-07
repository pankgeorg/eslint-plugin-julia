# julia/no-duplicate-keyword-arguments

Recommended; no options or edits. Reports repeated explicit bare `name=value`
arguments in ordinary prefix calls, both before and after `;`, including across
the two groups.

```julia
f(a=1, a=2)    # duplicate
f(; a=1, a=2)  # duplicate
f(a=1; a=2)    # duplicate
f(a=1, b=2)    # accepted
```

JuliaSyntax places the first form's assignments directly in the call and the
second form's assignments inside `parameters`. Native Julia 1.13.2 `Meta.lower`
rejects all three duplicate examples with `keyword argument "a" repeated in call
to "f"`. Recorded evidence and its regeneration script are included.

Skips signatures and their defaults, macro calls, quotes, dotted calls, shorthand
keywords, non-bare names, and parenthesized positional assignments. An argument
list containing any direct splat is skipped entirely. Named tuples are not calls.
It does not evaluate dynamic splats, match normalized Unicode aliases, or inspect
macro expansion. No automatic deletion chooses between values or discards effects.
