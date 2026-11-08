# julia/prefer-isempty

Suggests isempty/!isempty for length comparisons against integer zero/one, including reversed comparisons. Also suggests reviewing size(x,1)==0. Opt-in (`all`). Suggestions only; no automatic fix. Replacements preserve outer trivia and are withheld when comments would be removed or Base is shadowed.

```julia
length(xs) > 0 # consider !Base.isempty(xs)
```

Options: allowLengthComparison: true disables the preference. dimensions: false excludes size checks.

A zero first dimension and whole-array emptiness differ for arrays with another zero dimension. Custom length/size/isempty methods and iterator effects can differ; suggestions require review. Impossible tests such as length(x)<0 are excluded.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.
