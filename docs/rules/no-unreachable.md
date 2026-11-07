# julia/no-unreachable

Reports executable statements after `return`, `break`, or `continue` in the same
block, flattening ordinary `begin` and top-level containers. Declarations are
excluded. No options or edits.

```julia
function f()
    return 1
    work() # reported
end
for x in xs
    break
    work(x) # reported
end
```

Fallbacks for unknowables: calls named `throw` or `error` are not syntax exits;
resolving them needs track S. No imports, includes, eval, or call effects are
inferred. Blocks containing macros are skipped because macros may introduce
labels or exits. Quoted code and macro payloads are excluded. Nested function
exits do not terminate their enclosing block. Branch joins and try/finally effects
are not analyzed. Deferred declarations can still have lowering effects, so this
rule offers no deletion. Low shortlist FP risk; config placement follows the
recorded corpus audit.

Recommended after the 2,518-file corpus audit: both findings were true positives.
