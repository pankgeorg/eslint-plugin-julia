# julia/parse-errors

Recommended, error severity; no options or edits. Reports every level-1
JuliaSyntax diagnostic with UTF-16 locations when `languageOptions.recover` is
true. For example, `x = )` reports an unexpected token and a recovery diagnostic.
`α = √2; 🐱 = 1` is valid.

Without recovery, the language returns fatal parsing problems before rules run,
even if this rule is off. Recovery reports can be suppressed with ESLint comments.
Disabling this rule does not remove stored diagnostics or permit other plugin
rules to offer edits on an invalid file. JuliaSyntax checks parsing, not all
lowering errors or macro expansion. Its grammar is pinned to Julia 1.13.2.
