# julia/no-undefined-exports

Reports export/public names absent from the same file's module bindings, explicit
imports and implicit Base/Core exports. Later definitions satisfy an export;
child/sibling modules do not. Opt-in (`all`); no edits.

```julia
module M
    export answer
    const anser = 42 # answer has no definition
end
```

Options: `includes: "skip"` (default) suppresses reports in a module containing
include/eval/include_string; `"report"` uses strict file semantics. It recognizes
qualified calls, conservatively without evaluating their receiver.
`unknownModules: "skip"` (default) suppresses a module with unconfigured bare using;
`"report"` checks anyway. `moduleExports: {M:["x"]}` supplies known exports;
`globals: []` exempts supplied names. No dependency or included file is loaded.

Export statements never define bindings. Macro-generated definitions do not count;
`@enum Color red` followed by `export red` is unresolved under this model. Macro
names defined by ordinary `macro` declarations do count. Literal quotes are data.
Exact source spellings only. These fallbacks do not prove a runtime API is complete.
