# no-loss-of-float-integer-precision

Reports explicitly integer-valued decimal Float64/Float32 literals whose written
integer is not exactly representable: `9007199254740993.0` or `16777217f0`.
The rule parses the written integer with exact arithmetic and checks binary spacing
at the target precision (53 or 24 significant bits).

No options. Supports all-zero decimal fractional parts and Float32 `f0` suffixes,
including signs and separators. Bare Julia integers, nonzero fractions, general
exponents, hexadecimal floats, overflows and spellings longer than 330 characters
are excluded. Opaque macros, macro strings and quoted code are skipped. No name or
type inference is needed; shadowing builtins does not affect literal syntax.
Approximate constants can intentionally round, so findings still need review.

No fix or suggestion: changing type, spelling a rounded integer or using a
string-based arbitrary-precision constructor represent different intentions.
`BigFloat(9007199254740993.0)` cannot recover precision already lost in the literal.
