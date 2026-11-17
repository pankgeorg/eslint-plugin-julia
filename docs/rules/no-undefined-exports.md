# julia/no-undefined-exports

Reports export/public names absent from the same module across resolved includes bindings, explicit
imports and implicit Base/Core exports. Later definitions satisfy an export;
child/sibling modules do not. Opt-in (`all`); no edits.

```julia
module M
    export answer
    const anser = 42 # answer has no definition
end
```

Options: `includes: "skip"` (default) suppresses reports in a module containing
unresolved includes/eval/include_string anywhere in its include tree; `"report"` checks anyway.
Resolved literal includes contribute names and do not suppress checks. It recognizes
qualified calls, conservatively without evaluating their receiver.
`unknownModules: "skip"` (default) suppresses a module with unresolved bare using/import;
`"report"` checks anyway. `moduleExports: {M:["x"]}` supplies known exports;
`globals: []` exempts supplied names. Dependency syntax is parsed through [module resolution](../module-resolution.md); no Julia code is run.

Export statements never define bindings. Macro-generated definitions do not count;
`@enum Color red` followed by `export red` is unresolved under this model. Macro
names defined by ordinary `macro` declarations do count. Literal quotes and export syntax inside macro operands are data for this rule.
Exact source spellings only. These fallbacks do not prove a runtime API is complete.
