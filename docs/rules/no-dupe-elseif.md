# julia/no-dupe-elseif

Reports later conditions with the same normalized syntax tree in one
`if`/`elseif` chain. No options or edits. Identifier/literal conditions,
comparisons, negation, and logical combinations are supported.

```julia
if ready
    start()
elseif (ready) # reported
    stop()
end
if poll()
    start()
elseif poll() # accepted: another call can produce another result
    stop()
end
```

Tree identity compares kinds, exact leaf text, and semantic flags; it ignores
whitespace/comments and redundant parentheses. It does not reorder operands.
Calls, indexing, property reads, assignments, macros, and unknown condition
shapes stop comparison for the rest of that chain. Separate nested conditionals
are checked separately; macro payloads and quoted code are skipped.

Fallbacks for unknowables: no name resolution or constant propagation is used.
Includes/imports/eval do not establish equality. Overloaded comparisons and
concurrent changes to globals can invalidate assumptions about repeated reads;
this is a suspicious repetition check, not proof of unreachable code. Medium
shortlist FP risk; enabled only in `all`.
