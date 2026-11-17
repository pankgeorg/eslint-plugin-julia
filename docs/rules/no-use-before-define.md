# julia/no-use-before-define

Reports resolved local reads before a first initializer on straight-line code in
the same lexical scope. A later assignment establishes the binding, but does not
initialize an earlier read. Bare `local x` also does not initialize x. Opt-in
(`all`); no edits.

```julia
f() = (println(x); x=1) # x is read too soon
f() = (x=1; println(x)) # accepted
```

Options: `checkGlobals: false` by default; true also checks textual module-global
order. Functions/types/macros are hoisted by default; `functions: true` checks
their textual order. `dynamicInitialization: "strict"` (default) invents no
initialization from macros/include/eval/bare using; `"ignore-containing-scope"`
suppresses scopes containing a macro/include/eval operation.

This is conservative initialization checking, not a control-flow graph. It skips
reads in branches/loops/try regions, after control-flow joins or terminators, and
captures from a different scope, and signature expressions (which have separate
evaluation rules). Deferred closures and mutually recursive methods
are accepted. Unresolved names belong to no-undef. Literal quoted code is data;
the documented `@gensym` exception initializes its written names; other
are accepted. `@testset` block and loop bodies have local scopes, so a
closure updating an initialized testset local is treated as a capture rather
than an uninitialized function local. Unresolved names belong to no-undef. Literal quoted code is data;
macro expansion never initializes a binding. Exact spellings only.
