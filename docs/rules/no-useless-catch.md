# no-useless-catch

Reports a `catch` containing only resolved builtin zero-argument `rethrow()` when
the `try` has neither `else` nor `finally`. Such a catch simply propagates the
active exception. Logging, transformations, type-applied calls and `rethrow(err)` are excluded.

The option `{ allowComment: true }` is the default: a comment anywhere in the catch
exempts it, allowing documented debugger hooks. Set it to `false` to check those
catches too. Opaque macros, quoted code and shadowed or unresolved `rethrow` calls
are skipped. An undocumented breakpoint can still be intentional.

No fix or suggestion: removing or unwrapping the `try` can change local scope and
binding lifetime. This is a cleanup check, not exception-flow analysis.
