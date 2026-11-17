# no-single-iteration-loop

Reports a `for` or `while` with a straight-line body ending in an unconditional `break` or a function `return`.

Such a loop can execute at most once. Check whether iteration, first-element selection or a conditional was intended.

## Options

None.

## Edits

No automatic fix or suggestion: the intended correction requires review.

## Fallbacks and limitations

This is not a full control-flow analysis. Branches, short-circuit operators, nested scopes, nested loops, macros, exception handling and continue paths are excluded. A deliberate first-item implementation is a valid reason to disable this policy.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.
