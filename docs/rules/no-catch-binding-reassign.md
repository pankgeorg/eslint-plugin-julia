# no-catch-binding-reassign

Reports assignment or compound assignment to the binding introduced by `catch err`,
including nested functions capturing that binding. Replacing it can lose the
original caught object; a separate `wrapped` variable makes the distinction clear.

No options. Property/index mutation and a new shadowing binding are allowed.
The catch initialization itself is excluded. Opaque macros, quoted code and
unresolved bindings are skipped. This is an intent check: exception wrapping is
sometimes deliberate. Zero-argument `rethrow()` still uses the active exception
independently of the catch variable.

No fix or suggestion: choosing a new target name also requires deciding which
later references should continue to refer to the original exception.
