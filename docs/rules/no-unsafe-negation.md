# julia/no-unsafe-negation

Reports an unparenthesized prefix `!` as the left operand of an ordinary
membership/type/comparison expression, including comparison-chain heads.
No options. Only `all` enables this precedence warning.

```julia
!x in values # reported
!a isa T     # reported
!(x in values) # accepted
(!x) == y      # accepted
```

Suggestions make either meaning explicit: `(!x) in values` preserves grouping;
`!(x in values)` changes grouping. Neither is an autofix. Suggestions are withheld
when the comparison contains comments. Dotted comparisons and explicitly grouped
left operands are excluded. Macros and quoted code are skipped.

Fallbacks for unknowables: bindings, operand types, and overloads are not
inferred. Imports/includes/eval do not change precedence. Negating a Bool before
comparison can be intentional; this rule asks for parentheses rather than
claiming that valid expression is always wrong. Medium shortlist FP risk.
