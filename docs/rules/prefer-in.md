# julia/prefer-in

Suggests membership for any(==(needle), xs) and simple one-argument equality lambdas in either equality order. Opt-in (`all`). Suggestions only; no automatic fix. Replacements preserve outer trivia and are withheld when comments would be removed or Base is shadowed.

```julia
any(item -> item == needle, haystack) # consider needle in haystack
```

Options: No options.

Needle must be a bare name or noninterpolated literal, haystack a bare name; reject dependent needles, effectful expressions, splats and multi-statement lambdas. Equality orientation, missing, custom membership/hash semantics and evaluation order require review.

Only pinned Base/Core builtin identities and normal same-file bindings are trusted. Local shadowing wins; include/eval/unknown using exports and macro expansion never create inferred identities. Unknown call origins are skipped. Configure ordinary imports or suppress the rule for dynamic APIs. Macros, literal quotes and signatures are excluded; exact source spellings only. No Julia code or dependencies are executed.

Enclosing `Base.in` implementations are excluded: membership would recurse.
