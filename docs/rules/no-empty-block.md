# julia/no-empty-block

Reports empty bodies of `if`/`elseif`/`else`, `for`, `while`, functions with an
explicit body, and `let`. Empty `begin` wrappers are flattened; `nothing` is an
explicit nonempty body. No edits. Only `all` enables this policy rule.

```julia
if ready # reported
end
function f() # reported
end
function f end # accepted generic declaration
for x in items
    # Deliberately exhaust the iterator.  Accepted by default.
end
```

Options: `allowComment` defaults to true and accepts comments wholly inside the
body. `allowEmptyWhile` defaults to false; true permits empty polling loops.
Catch, try/finally, struct/module, standalone begin, macro payloads, and quotes
are excluded. Generic function declarations without an executable body are
accepted. The task explicitly includes functions and let bodies, extending the
narrower source-a shortlist while preserving its generic-declaration exemption.

Fallbacks for unknowables: no names, effects, or macro expansions are inferred.
Imports/includes/eval do not change the written emptiness. Intentional stubs,
iterator exhaustion, and polling can match; add a comment or disable locally.
Removing a loop or let can change evaluation, scope, and implicit values, so no
fix is offered. Medium shortlist FP risk.
