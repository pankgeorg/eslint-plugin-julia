# Default configuration: which rules are on, and why

`recommended` turns on rules that catch likely bugs with near-zero false positives (ESLint's own bar): **error** when a finding is almost always a bug, **warn** when it is a probable bug with occasional deliberate uses. Everything else is opt-in; `strict` turns all of it on as warnings (one line: `julia.configs.strict`).

Evidence: findings with every rule on, over a 2,518-file sample of real Julia code (Julia base/stdlib/test and package sources; one in ten files of a 25,174-file corpus), and over Pluto.jl (138 files) and Malt.jl (13 files) with their environments instantiated. Per-rule false-positive classification is in each rule's pull request.

| rule | default | corpus sample | Pluto.jl | Malt.jl | why |
|---|---|---:|---:|---:|---|
| `no-dupe-args` | **recommended (error)** | 0 | 0 | 0 | Julia rejects the method definition |
| `no-duplicate-keyword-arguments` | **recommended (error)** | 0 | 0 | 0 | Julia rejects the call |
| `no-duplicate-struct-fields` | **recommended (error)** | 0 | 0 | 0 | Julia rejects the definition |
| `no-import-assign` | **recommended (error)** | 2 | 0 | 0 | assigning an imported binding is an error in Julia |
| `no-unreachable` | **recommended (error)** | 2 | 0 | 0 | dead code after return/break/continue; both corpus findings real |
| `no-unsafe-finally` | **recommended (error)** | 1 | 0 | 0 | exit from `finally` replaces a pending return/exception; corpus finding real |
| `parse-errors` | **recommended (error)** | 0 | 0 | 0 | JuliaSyntax syntax errors (with `recover: true`); fatal otherwise |
| `prefer-ismissing` | **recommended (error)** | 0 | 0 | 0 | `x == missing` is `missing`, a TypeError in a condition |
| `use-isnan` | **recommended (error)** | 0 | 0 | 0 | `x == NaN` is always false |
| `no-const-reassign` | **recommended (warn)** | 2 | 0 | 0 | reassigning a `const` global: warns at run time; deliberate in scripts |
| `no-discarded-copy-result` | **recommended (warn)** | 0 | 0 | 0 | `sort(x)` as a statement: the result is dropped (`sort!` meant?) |
| `no-dupe-elseif` | **recommended (warn)** | 0 | 0 | 0 | a repeated condition makes a branch dead; rare |
| `no-duplicate-logical-operands` | **recommended (warn)** | 0 | 0 | 0 | `a && a`: a typo for another operand; rare |
| `no-fill-with-mutable` | **recommended (warn)** | 0 | 0 | 0 | `fill([], n)` shares one object; occasionally deliberate |
| `no-self-assign` | **recommended (warn)** | 1 | 0 | 0 | `x = x`: almost always a mistake; rare |
| `no-shadowed-loop-var` | **recommended (warn)** | 6 | 0 | 0 | inner loop rebinding the outer loop variable; sometimes deliberate |
| `no-unsafe-negation` | **recommended (warn)** | 1 | 0 | 0 | `!a in b` negates `a`, not the test |
| `no-unused-expressions` | **recommended (warn)** | 10 | 1 | 0 | discarded comparisons: real missing `@test`/`=` (≈ 9 of 10 sample findings) |
| `no-collapsible-if` | off (strict: warn) | 70 | 3 | 0 | style / policy (opt-in) |
| `no-cond-assign` | off (strict: warn) | 6 | 3 | 0 | style / policy (opt-in) |
| `no-constant-condition` | off (strict: warn) | 9 | 1 | 0 | style / policy (opt-in) |
| `no-duplicate-method-signatures` | off (strict: warn) | 27 | 1 | 0 | mostly deliberate redefinitions in tests |
| `no-empty-block` | off (strict: warn) | 19 | 0 | 0 | style / policy (opt-in) |
| `no-empty-catch` | off (strict: warn) | 27 | 4 | 1 | style / policy (opt-in) |
| `no-identical-branches` | off (strict: warn) | 89 | 8 | 0 | style / policy (opt-in) |
| `no-unbound-type-parameters` | off (strict: warn) | 31 | 0 | 0 | Aqua-style; often deliberate |
| `no-undef` | off (strict: warn) | 9142 | 16 | 0 | needs the full environment (Manifest + depot); most remaining findings are names defined in ways syntax can't see |
| `no-undefined-exports` | off (strict: warn) | 353 | 0 | 0 | mostly JLL wrapper exports made by macros |
| `no-unused-type-parameters` | off (strict: warn) | 7 | 0 | 0 | hygiene |
| `no-unused-vars` | off (strict: warn) | 2175 | 92 | 3 | mostly true but hygiene (unused imports/locals), ~0.9 per file |
| `no-use-before-define` | off (strict: warn) | 32 | 0 | 0 | all sampled findings debatable |
| `prefer-const-global` | off (strict: warn) | 0 | 0 | 0 | performance advice |
| `prefer-eachindex` | off (strict: warn) | 17 | 0 | 0 | style / policy (opt-in) |
| `prefer-identity-nothing` | off (strict: warn) | 49 | 0 | 0 | style / policy (opt-in) |
| `prefer-in` | off (strict: warn) | 2 | 0 | 0 | style / policy (opt-in) |
| `prefer-isa` | off (strict: warn) | 72 | 0 | 0 | style / policy (opt-in) |
| `prefer-isempty` | off (strict: warn) | 107 | 12 | 0 | style / policy (opt-in) |
