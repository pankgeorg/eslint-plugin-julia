# no-string-growth-in-loop

Review `s *= chunk` or `s = s * chunk` in a loop immediately preceded by a local, noninterpolated string initializer. All writes must be recognized concatenation recurrences; no other prefix reads or closure captures are allowed.

```julia
s = ""
for x in xs
    s = s * string(x)
end
```

Ordinary String concatenation copies the accumulated byte prefix on each iteration. Equal positive-size chunks can therefore cause quadratic copying. Unicode character counts are not byte counts. The rule reports possible repeated construction, without inferring the chunk type or measuring runtime.

There are no options or edits. Consider `IOBuffer` with `print`/`write`, or `join` when appropriate. Review custom `*` dispatch, output formatting, encoding, exceptions and lifetime: printing a value need not equal concatenating it. Retain the recurrence or disable this opt-in rule for short/cold loops or intentional behavior.

Only adjacent same-block initialization and straight-line `for`/`while` bodies are supported. Resets, conditional writes, intermediate prefix observations, aliases through explicit reads, nested loops, closures, macros, quoted code, global accumulators and shadowed multiplication are excluded. Numeric products and unknown incoming accumulators are not diagnosed. Calls can still have effects invisible to lexical analysis.
