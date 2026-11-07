# julia/no-identical-branches

Reports identical nonempty branch bodies in a single `if`/`elseif`/`else` chain,
and identical ternary arms. If every explicit branch matches, reports once at
the conditional; otherwise reports each later repeated body. No options or edits.

```julia
if ready
    start()
else
    start() # identical bodies: reported once at if
end
ready ? value : value # reported
ready ? "a b" : "ab" # accepted
```

The shared tree comparison retains kinds, exact leaf text, and semantic flags,
ignoring trivia/comments and redundant parentheses. String contents remain
significant. Empty branches and distinct conditionals are not merged.

Fallbacks for unknowables: no name resolution is required. Includes, eval,
imports, and overloaded calls do not alter structural identity. Identical code
may deliberately document distinct cases, so findings require review and the
rule is only in `all`. Quoted syntax and macro payloads are skipped. No rewrite
is offered: conditions may have effects, and the intended body may be different.
