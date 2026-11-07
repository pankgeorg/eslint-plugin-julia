# julia/no-discarded-copy-result

Reports non-final direct statements in function/arrow/do body blocks calling known sort, reverse, unique, copy or filter. The returned copy is syntactically discarded. Opt-in (`all`). No edits.

```julia
function f(xs)
    sort(xs) # result dropped
    return xs
end
```

Options: knownArraysOnly: true restricts input to array literals. checkCallbacks: false excludes filter.

Final expressions are implicit returns. Globals, nested blocks, wrappers, splats and sort callback keywords are excluded. Filter is included per the task, but callbacks and custom methods may intentionally execute effects. No mutation rewrite is safe, so no fix is offered.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
