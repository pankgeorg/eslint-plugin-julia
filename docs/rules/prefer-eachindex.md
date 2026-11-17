# julia/prefer-eachindex

Suggests eachindex for a single loop/comprehension binder over 1:length(xs) when every read of the index is the sole index in xs[i]. Opt-in (`all`). Suggestions only; no automatic fix. Replacements preserve outer trivia and are withheld when comments would be removed or Base is shadowed.

```julia
for i in 1:length(xs)
    consume(xs[i])
end
```

Options: allowCapture: true permits nested-function index captures; default false.

Rejects numerical index uses, other arrays, index/array writes and visible structural mutations. Unknown callees can still mutate. Offset/string axes intentionally change; no type inference or universal equivalence is claimed.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
