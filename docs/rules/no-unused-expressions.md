# julia/no-unused-expressions

Reports standalone identifiers and numeric/Bool/character/symbol/plain-string
literals only when their value is definitely discarded. No edits.
Only `all` enables this rule. Option `checkTopLevel` defaults to false: file/module
statements may be Literate or notebook outputs. True enables those checks too;
the final file/module expression is still preserved.

```julia
function f(x)
    42 # reported
    x  # reported
    return 1
end
function g(x)
    x # accepted: implicit return
end
```

Final expressions flow through begin, let, conditionals, and try/catch into
the enclosing value position. Function/lambda/do and module/file final values
are preserved. Loop and finally body values are discarded. `nothing` as an
intentional no-op, docstrings, interpolated strings, macro payloads, and quoted
code are excluded; simple `:symbol` literals are supported. Strings before a declaration or macro
and leading strings in function/lambda/do bodies are conservatively treated as potential documentation strings, including local docstrings
that the parser does not wrap in a doc node.

Fallbacks for unknowables: calls, comparisons (including `x == y`), arithmetic,
property/index reads, and assignments are excluded because overloaded methods
may have effects. This deliberately narrows the merged task's comparison example
using source-a's explicit effect policy. No name resolution or general purity
analysis is promised; imports/includes/eval do not establish effects. Bare reads
may intentionally probe initialization and literals can mark scaffolding, so
medium shortlist FP risk requires local review. Unknown value-flow shapes are
skipped instead of assuming a result is discarded.
