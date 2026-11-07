# julia/prefer-identity-nothing

Opt-in idiom preference. Suggests `===` for `==` and `!==` for `!=` when one
operand is the bare identifier `nothing`. It is suggestion-only by default:
`eslint --fix` leaves the file unchanged. Set `['warn', { fix: true }]` to enable
operator-only autofixes as well as suggestions. `{ fix: false }` is the default.

```julia
x == nothing     # suggests x === nothing
nothing != x     # suggests nothing !== x
x === nothing    # accepted
```

Only exact three-child ordinary infix calls are checked. Dotted/suffixed/prefix
operators, comparison chains, strings, signatures (including defaults), macros,
and quoted code are skipped. Parenthesized/quoted spellings of nothing are not
inferred. Comments, Unicode text, and line endings around the operator survive.
No fixes or suggestions are offered on recovered files with parser errors.

Equality is overloadable, and `nothing` can be locally rebound. This rule cannot
prove the replacement equivalent, so it is excluded from recommended. Review a
suggestion before accepting it; autofix is an explicit semantic tradeoff.
