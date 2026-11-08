# Default configuration: which rules are on, and why

`recommended` turns on rules that catch likely bugs with near-zero false positives (ESLint's own bar): **error** when a finding is almost always a bug (Julia rejects the code, or the check can never be right), **warn** when it is a probable bug with occasional deliberate uses. Everything else is opt-in; `strict` turns all of it on as warnings (`julia.configs.strict`).

Evidence: findings with every rule on, over a 2,518-file sample of real Julia code (Julia base/stdlib/test and package sources; one in ten files of a 25,174-file corpus), and over Pluto.jl (138 files) and Malt.jl (13 files) with their environments instantiated. Per-rule classification of findings is in the pull requests.

66 rules: 12 recommended as error, 11 as warn, 43 opt-in.

| rule | default | corpus sample | Pluto.jl | Malt.jl | why |
|---|---|---:|---:|---:|---|
| `no-dupe-args` | **recommended (error)** | 0 | 0 | 0 | Julia rejects the method definition |
| `no-duplicate-keyword-arguments` | **recommended (error)** | 0 | 0 | 0 | Julia rejects the call |
| `no-duplicate-struct-fields` | **recommended (error)** | 0 | 0 | 0 | Julia rejects the definition |
| `no-import-assign` | **recommended (error)** | 2 | 0 | 0 | Julia errors: "cannot assign a value to imported variable" |
| `no-invalid-foreign-call-signature` | **recommended (error)** | 0 | 0 | 0 | `ccall` arity mismatch / untyped `@ccall` arguments fail at lowering |
| `no-isdefined-local-call` | **recommended (error)** | 0 | 0 | 0 | `isdefined(:x)` throws ArgumentError (needs a module or object) |
| `no-uninitialized-ref-read` | **recommended (error)** | 0 | 0 | 0 | `Ref{String}()[]` throws UndefRefError (non-bits element types) |
| `no-unreachable` | **recommended (error)** | 2 | 0 | 0 | dead code after return/break/continue; corpus findings real |
| `no-unsafe-finally` | **recommended (error)** | 1 | 0 | 0 | exit from `finally` replaces a pending return/exception; corpus finding real |
| `parse-errors` | **recommended (error)** | 0 | 0 | 0 | JuliaSyntax syntax errors (with `recover: true`); fatal otherwise |
| `prefer-ismissing` | **recommended (error)** | 0 | 0 | 0 | `x == missing` is `missing`, a TypeError in a condition |
| `use-isnan` | **recommended (error)** | 0 | 0 | 0 | `x == NaN` is always false |
| `no-const-reassign` | **recommended (warn)** | 2 | 0 | 0 | reassigning a `const` global; deliberate in scripts |
| `no-discarded-copy-result` | **recommended (warn)** | 0 | 0 | 0 | `sort(x)` as a statement drops the result |
| `no-dupe-elseif` | **recommended (warn)** | 0 | 0 | 0 | a repeated condition makes a branch dead; rare |
| `no-duplicate-dict-keys` | **recommended (warn)** | 0 | 0 | 0 | a later duplicate key silently wins in `Dict(k => v, …)` |
| `no-duplicate-logical-operands` | **recommended (warn)** | 0 | 0 | 0 | `a && a`: a typo for another operand |
| `no-fill-with-mutable` | **recommended (warn)** | 0 | 0 | 0 | `fill([], n)` shares one object |
| `no-nothing-return-conversion` | **recommended (warn)** | 0 | 0 | 0 | a declared return type that a `nothing` path cannot convert to |
| `no-self-assign` | **recommended (warn)** | 1 | 0 | 0 | `x = x`: almost always a mistake |
| `no-shadowed-loop-var` | **recommended (warn)** | 6 | 0 | 0 | inner loop rebinding the outer loop variable; sometimes deliberate |
| `no-unsafe-negation` | **recommended (warn)** | 1 | 0 | 0 | `!a in b` negates `a`, not the test |
| `no-unused-expressions` | **recommended (warn)** | 10 | 0 | 0 | discarded comparisons: missing `@test`/`=` (most corpus findings real); notebooks exempt |
| `no-collapsible-if` | off (strict: warn) | 70 | 3 | 0 | style / policy / narrow check (opt-in) |
| `no-collect-before-range-iteration` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-compare-negative-zero` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-concat-growth-in-loop` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-cond-assign` | off (strict: warn) | 6 | 3 | 0 | style / policy / narrow check (opt-in) |
| `no-constant-condition` | off (strict: warn) | 9 | 1 | 0 | style / policy / narrow check (opt-in) |
| `no-duplicate-method-signatures` | off (strict: warn) | 27 | 1 | 0 | mostly deliberate redefinitions in tests |
| `no-empty-block` | off (strict: warn) | 19 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-empty-catch` | off (strict: warn) | 27 | 4 | 1 | style / policy / narrow check (opt-in) |
| `no-empty-literal-range` | off (strict: warn) | 2 | 0 | 0 | findings were deliberate test fixtures |
| `no-eval-local-symbol` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-full-slice-in-consumer` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-identical-branches` | off (strict: warn) | 89 | 8 | 0 | style / policy / narrow check (opt-in) |
| `no-impossible-length-comparison` | off (strict: warn) | 12 | 0 | 0 | mostly deliberate generic/defensive checks |
| `no-loss-of-float-integer-precision` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-obvious-type-piracy` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-overwritten-literal-index` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-redundant-type-assertion` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-redundant-union-members` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-self-identity-comparison` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-single-iteration-loop` | off (strict: warn) | 2 | 0 | 0 | findings were deliberate test fixtures |
| `no-string-growth-in-loop` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `no-throw-literal` | off (strict: warn) | 30 | 4 | 0 | throwing a String instead of an exception: hygiene (Pluto: 4 real) |
| `no-unbound-type-parameters` | off (strict: warn) | 31 | 0 | 0 | Aqua-style; often deliberate |
| `no-undef` | off (strict: warn) | 9142 | 16 | 0 | needs the full environment (Manifest + depot); remaining findings are often names defined in ways syntax can't see |
| `no-undefined-exports` | off (strict: warn) | 353 | 0 | 0 | mostly JLL wrapper exports made by macros |
| `no-unused-type-parameters` | off (strict: warn) | 7 | 0 | 0 | hygiene |
| `no-unused-vars` | off (strict: warn) | 2175 | 92 | 3 | mostly true but hygiene (unused imports/locals) |
| `no-use-before-define` | off (strict: warn) | 32 | 0 | 0 | sampled findings debatable |
| `no-useless-assignment` | off (strict: warn) | 1 | 0 | 0 | narrow dead-store check; deliberate in tests |
| `no-useless-catch` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-any` | off (strict: warn) | 1 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-const-global` | off (strict: warn) | 0 | 0 | 0 | performance advice |
| `prefer-count-over-findall-length` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-eachindex` | off (strict: warn) | 12 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-extreme-over-sort` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-generator-sum` | off (strict: warn) | 1 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-identity-nothing` | off (strict: warn) | 49 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-in` | off (strict: warn) | 2 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-isa` | off (strict: warn) | 71 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-isempty` | off (strict: warn) | 98 | 12 | 0 | style / policy / narrow check (opt-in) |
| `prefer-size-dimension` | off (strict: warn) | 0 | 0 | 0 | style / policy / narrow check (opt-in) |
| `prefer-sized-push-buffer` | off (strict: warn) | 1 | 0 | 0 | performance advice |
