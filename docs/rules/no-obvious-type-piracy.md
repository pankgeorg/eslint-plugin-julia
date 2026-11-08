# no-obvious-type-piracy

Reports explicitly qualified builtin Base/Core generic extensions in a named
project when every positional argument is a supported simple builtin type or
unannotated `Any`, for example `Base.length(x::Int) = 1`. Such methods extend a
foreign function for foreign types and can affect unrelated callers.

No options. A readable ancestor `Project.toml` with a name establishes project
context. Projects or enclosing modules named Base/Core are excluded. Without a
known project owner the rule skips the file. A small generic-function catalogue
excludes constructors and callable objects. A conservative named builtin type
catalogue proves argument ownership; any local/project type or unknown type
prevents a report. This folds the simple Base piracy check into one rule.

`where`, defaults, varargs, keywords, zero-argument methods, composite types,
computed annotations, arbitrary package imports and unknown origins are skipped.
Opaque macros and quoted code are excluded. This is an opt-in review aid, not
whole-package ownership analysis or a replacement for runtime tools such as Aqua.
Intentional compatibility patches can be reported.

No fix or suggestion: choosing a new generic, wrapper type or extension policy is
an API design decision.
