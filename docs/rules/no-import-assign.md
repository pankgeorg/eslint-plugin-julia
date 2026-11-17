# julia/no-import-assign

Reports assignment, compound assignment and explicit global writes to imported
bindings in the same module. Supports import/using names, aliases and written
module names. Opt-in (`all`); no edits.

```julia
import Base: sqrt as root
root = 2 # report
import Base: show
show(io::IO, x::MyType) = print(io,x) # method extension, accepted
```

A local assignment may create a separate local and is accepted. Property/index
mutation and added methods do not rebind the imported name. Explicit import
identity is collected before reads/writes, including imports later in the file.
Import/write pairs in mutually exclusive arms of the same if/elseif are excluded;
other control-flow reachability is not inferred.

Option `moduleExports: {M:["x"]}` marks configured names from bare using M as
imports. Otherwise bare using binds only its written module name. Includes/eval
and macro expansion create no inferred imports; unknown writes are left alone.
Written ordinary imports/assignments inside macros count; quotes do not. Exact
spellings only; runtime package exports and dispatch are not inspected.
