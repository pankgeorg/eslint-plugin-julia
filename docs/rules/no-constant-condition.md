# julia/no-constant-condition

Reports literal Bool conditions in `if`/`elseif`/ternary and `while false`, and
numeric, character, and plain string literals used directly as those conditions.
Julia requires a Bool: non-Bool literals are not truthy values.

```julia
if true # reported: constant
    work()
end
if "yes" # reported: not a Bool
    work()
end
while true # accepted by default
    step()
end
```

Options: `checkInfiniteLoops: true` reports `while true`; `checkWhileTrue` is an
alias (the former wins if both are supplied). `checkTernary: false` skips ternary
conditions. Defaults: infinite loops allowed, ternaries checked. No edits.

Fallbacks for unknowables: `nothing`, `missing`, and named constants are skipped
because they need name resolution. Calls, overloaded operators, interpolation,
macro strings, macro payloads (including `@static`), and quoted code are not
folded. This rule does not validate logical operands (`true && 1` is legal).
Imports/includes/eval do not change literal identity. Intentional scaffolding
may match; medium shortlist FP risk keeps the rule in `all` only.
