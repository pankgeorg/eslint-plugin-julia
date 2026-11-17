# julia/no-duplicate-logical-operands

Reports repeated bare identifiers in a maximal `&&` or `||` chain, including
`a && a` and `x || y || x`. Any non-identifier operand is an effect barrier:
`a && poll() && a` is accepted. No options. Only `all` enables this rule.

```julia
if ready && ready # reported, suggestion: if (ready)
    start()
end
x || y || x # reported; no edit outside a Boolean condition
if poll() && poll() # accepted
    work()
end
```

The shared normalized-tree helper compares kinds, semantic flags, and exact
leaf text, ignoring trivia and redundant parentheses. Mixed operators remain
separate chains. Property/index access, calls, and comparisons are excluded.
Quoted code and macro payloads are skipped.

Fallbacks for unknowables: no bindings or effects are resolved; non-identifier
operands stop tracking earlier names. Concurrent mutation of global names can
make repeated reads intentional. Suggestions remove one repeated operand only
in a Boolean condition of `if`/`elseif`/`while`/ternary, with no contained comments.
There is no autofix. Outside a Boolean condition, removing an operand could
change Julia's Bool validation, so no suggestion is offered. Even with low
shortlist FP risk, the broader nonadjacent and statement checks stay opt-in.
