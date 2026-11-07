# julia/no-undef

Reports executable identifier reads without a normal Julia binding in this file
or an implicit Julia 1.13.2 Base/Core export. Opt-in (`all`); no edits.

```julia
f(x) = x + offest  # offest is unresolved
using LinearAlgebra: norm
norm([1,2])         # explicit import is resolved
```

Options: `globals: []` supplies project names; `moduleExports: { M: ["x"] }`
supplies trusted exports for bare `using M`. `unknownModules: "ignore"` (default)
suppresses unknown-name reports throughout a file with an unconfigured bare using:
any unknown name might be one of its exports. Set `unknownModules: "report"`
for strict file semantics. `unknownGlobals: "ignore"` suppresses all unresolved
reads (default `"report"`). These options suppress reports; they never create
macro bindings. Bare using binds its written module name.

Include/eval definitions are unknowable and unresolved later reads are reported;
use `globals` for included/generated APIs. Stdlib modules such as Test are not
implicitly known merely because Julia ships them. `@enum X a b` creates no normal
bindings: a later `a` is reported. Opaque macro operands themselves are skipped;
written function bodies/assignments still participate. Quote interpolation is
executable; literal quoted names are data. Properties, keyword labels, named-tuple
keys and field declarations are excluded. Later local assignments resolve earlier
reads; initialization order belongs to no-use-before-define.

Single-file syntax cannot establish dependency exports, macro expansion, generated
code, include ordering, eval effects, or runtime dispatch. Exact spelling is used;
Unicode aliases and escaped var identifier equivalences are not normalized.
