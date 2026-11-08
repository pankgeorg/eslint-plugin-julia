# no-throw-literal

Reports resolved `throw` calls receiving a direct string, character, number, Boolean, `nothing` or `missing`.

Julia permits throwing arbitrary objects. Exception objects usually provide more useful diagnostics; this is an exception-hygiene policy, not a syntax error.

## Options

None.

## Edits

A direct string throw offers a suggestion to use `Base.error(message)` when Base is available and no comment would be removed. This changes the thrown object to an ErrorException; it is never automatic.

## Fallbacks and limitations

Variables, interpolated strings, constructors and collections are outside the literal subset. Intentional sentinel throws are possible.

Builtin identity uses the scope and module resolver. Shadowed or unresolved helpers are skipped. Opaque macros and quoted code are skipped. This rule is opt-in; it is included in `strict` as a warning.
