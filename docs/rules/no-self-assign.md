# julia/no-self-assign

Reports `x=x`, `a.b=a.b`, and matching tuple assignments when both sides refer to
the same written bindings. Opt-in (`all`); no options or edits. Typed bindings,
broadcast/compound assignment, index setters and let initializers are excluded.

```julia
f(x) = (x = x; x)       # report
f(x,y) = ((x,y)=(x,y))  # report
let x=x; println(x); end # deliberate new binding, accepted
```

Property checks compare the receiver's binding and literal property names; calls
such as `make().x` are excluded. Property getters/setters and typed global writes
can have effects: this is a suspicious-pattern policy, not proof of redundancy.
Global and otherwise uninitialized self-assignment are also suspicious. No rewrite
is offered. Arbitrary tuples must match in every position.

Names without resolved bindings are skipped. Includes/eval/bare using add no
invented bindings; no dynamic fallback is necessary for comparing known identity.
Macro-generated names are not inferred; opaque macro operands are skipped, while written function bodies inside macros
still count. Quotes and keyword/named-tuple labels are excluded. Exact spellings only.
