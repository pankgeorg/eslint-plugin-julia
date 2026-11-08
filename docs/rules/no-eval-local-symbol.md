# no-eval-local-symbol

Reports a recognized module eval of a single quoted symbol naming a lexical local, when the target module has no known global of that name.

Julia eval reads module globals, not the caller’s local environment. A matching local name often indicates an incorrect assumption about lexical evaluation.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

Supports ordinary module-injected eval(:name) and Core.eval(@**MODULE**, :name). Bare modules, explicit target modules, computed expressions and global name collisions are skipped. Unknown module exports/includes, visible macros and other eval/include/setglobal! writers suppress reports. The current call itself is allowed as the sole dynamic evaluator. Absence of future external global mutation cannot be proven: this is strict-only advice, with no automatic correction.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.

```julia
f(x) = eval(:x)  # Reported when the module has no x global.
f(x) = x        # Direct local lookup.

module Example
    const x = 10
    f(x) = eval(:x)  # Skipped: the global lookup may be intentional.
end
```

Core.eval must target the builtin zero-argument `@__MODULE__` macro. Shadowed eval functions and shadowed module macros are skipped. Dynamic writers include Core's set, modify, swap and replace global operations. No suggestion inserts interpolation outside quote syntax.
