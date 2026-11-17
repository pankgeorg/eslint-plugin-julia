# julia/no-unsafe-finally

Reports `return`, `break`, and `continue` whose syntactic target lies outside an
enclosing `finally`. No options or edits.

```julia
function f()
    try
        return 1
    finally
        return 2 # reported: replaces the pending result
    end
end
try
    work()
finally
    for x in xs
        break # accepted: target is inside finally
    end
end
```

Fallbacks for unknowables: targets come from syntax, so imports, includes, eval,
and unknown names require no fallback. Nested functions, lambdas, and do blocks
have their own return targets; inner loops have their own break/continue targets.
Quoted code and macro payloads are skipped. Calls that throw or suppress errors
are not analyzed. This checks explicit transfers, not every possible cleanup
hazard. Intentional suppression can be disabled locally. Low shortlist FP risk;
config placement follows the corpus audit.

Recommended after the 2,518-file corpus audit: the sole finding was a true positive.
