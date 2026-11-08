# no-self-identity-comparison

Reports scalar builtin `===` or `!==` comparing the same resolved local binding to
itself. Identity is reflexive even for NaN, so this often indicates a wrong-variable
typo. Value comparisons (`==`, `!=`) are untouched, including NaN tests.

No options. Parentheses are allowed. Globals, captured bindings, opaque macro
references, calls, properties, indices, broadcasts and unresolved bindings are
skipped. Opaque macros and quoted code are excluded. The rule uses binding identity,
not spelling; it does not infer types or the intent of deliberate identity tests.

No fix or suggestion: replacing the comparison with a constant can hide the typo
without identifying the intended other operand.
