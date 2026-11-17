# julia/no-unused-expressions

Reports standalone identifiers, numeric/Bool/character/symbol/plain-string
literals and comparisons (`x == 1`, `a < b`, chains, `in`/`isa`) only when their value
is definitely discarded. A discarded comparison is almost always a typo for `=` or a
forgotten `@assert`. No edits.
Only `all` enables this rule. Option `checkTopLevel` defaults to false: file/module
statements may be Literate or notebook outputs. True enables those checks too;
the final file/module expression is still preserved.

In Pluto notebooks whose first line is exactly `### A Pluto.jl notebook ###`,
bare identifiers (including parenthesized identifiers) and bare literals are accepted
everywhere (cells use them for reactivity and display scaffolding; comparisons are still reported),
even with `checkTopLevel: true`. A read such as `let; trigger; html"..." end`
creates a reactive dependency. LF and CRLF headers are recognized. Discarded
comparisons and other literal values remain checked; ordinary Julia files keep
their existing identifier checks.

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

Fallbacks for unknowables: calls (other than comparison operators), arithmetic,
property/index reads, and assignments are excluded because overloaded methods
may have effects. No name resolution or general purity
analysis is promised; imports/includes/eval do not establish effects. Bare reads
may intentionally probe initialization and literals can mark scaffolding, so
medium shortlist FP risk requires local review. Unknown value-flow shapes are
skipped instead of assuming a result is discarded.
