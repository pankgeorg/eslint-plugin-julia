# julia/no-shadowed-loop-var

Recommended; no options or edits. Reports an inner `for` binding that repeats the
exact spelling of a variable bound by an enclosing loop, when the inner loop is
in that loop's body. Handles bare bindings and nested tuple destructuring.
Comprehensions and generators count, including successive `for` clauses and
filtered clauses.

```julia
for (i, x) in pairs(xs)
    for i in ys  # shadows enclosing i
    end
end
[i for i in xs for i in ys]  # shadows enclosing i
for i in xs
    for j in ys  # accepted
    end
end
```

`outer` bindings are skipped: they request reuse rather than a new loop variable.
All-underscore names are ignored. Comma-separated bindings within a single header
are not treated as nested `for` clauses. A loop's iterable is outside that loop's
binding scope, so `for i in (i for i in xs)` is accepted. Separate sibling loops
may reuse a name.

The check stops at function, arrow, do, let, module, macro-definition, and struct
boundaries. It skips macros, quotes, typed/unknown binding patterns, and normalized
Unicode aliases. It does not resolve all Julia bindings, determine whether an
outer value is later used, or analyze `while` loops or assignments. In particular,
let scopes are conservatively skipped even if they do not bind the repeated name.
This is a narrow syntactic warning about likely mistakes, not proof of a runtime
error. Renaming automatically would require binding analysis, so there is no fix.

A small Julia base audit found two real nested rebindings in 248 files. One looks
intentional (`expr.jl`); another merits review (`errorshow.jl`, with a later use of
the outer index). These findings do not establish a Julia bug. Teams that permit
intentional nesting can disable this rule. The larger planned corpus audit remains
outstanding.
