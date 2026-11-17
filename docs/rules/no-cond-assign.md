# julia/no-cond-assign

Reports assignments evaluated in `if`/`elseif`/`while`/ternary conditions and
Boolean-tested operands of `&&`/`||`. This includes assignment within call arguments and compound
or broadcast assignments. Keyword arguments and nested functions are excluded. A final short-circuit operand
is accepted when its result is not tested as a Bool (`ready && (x=1)`).

```julia
if (ready = true) # reported, suggestion: ready == true
    work()
end
while (item = nextitem()) !== nothing # accepted comparison guard
    consume(item)
end
```

Option `allowParenthesized: true` allows assignments explicitly wrapped in
parentheses (default false). An explicit comparison (including Unicode aliases, membership, and isa) or comparison chain is an
exemption barrier, allowing read-until-sentinel guards. Sequential begin/semicolon setup statements and let bindings are not tested;
only the final body value is scanned. The rule intentionally
misses assignments under those comparisons. Macro payloads and quoted syntax
are skipped. A suggestion changes `=` to `==` only when simple assignment is the
whole tested operand; nested/compound assignments have no suggested edit.
No autofix: the intended predicate is unknown.

Fallbacks for unknowables: no names are resolved and call effects are not
inferred. Imports/includes/eval cannot change the assignment syntax. Overloaded
comparison behavior is outside this check. Assignments in ordinary statements
or branch bodies are accepted. Medium shortlist FP risk; only `all` enables it.
