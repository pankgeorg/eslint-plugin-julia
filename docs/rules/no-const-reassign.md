# julia/no-const-reassign

Reports later writes to a global introduced by an initialized const declaration.
Plain/compound assignments, repeated const initializers, destructuring and explicit
global writes count. Mutation of the referenced object does not. Opt-in (`all`);
no edits.

```julia
const LIMIT=1
LIMIT=2 # report
const ITEMS=[1]
push!(ITEMS,2) # accepted
```

Option `readonlyGlobals: []` declares additional externally owned read-only names.
A local binding of the same spelling remains independent. This is a file
no-redefinition policy: Julia permits some const redefinitions, and runtime code
can call a function in a different order from its textual position. Deferred function writes are checked
even when their definitions precede const. Writes in a mutually exclusive
if/elseif arm from the const initializer are skipped; other reachability is unknown.

Include/eval/bare using and macro expansion supply no const declarations or
hidden writes. Configure readonlyGlobals for external names. Written ordinary
const/global declarations inside macros count; literal quotes do not. Exact
spellings only; the rule cannot establish initialization across files or sessions.
