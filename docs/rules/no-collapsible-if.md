# julia/no-collapsible-if

Reports an ordinary `if` with no alternate branch whose sole body statement is
another `if` with no alternate branch. No options. Only `all` enables it.

```julia
if ready()
    if permitted()
        start()
    end
end
# suggestion:
if (ready()) && (permitted())
    start()
end
```

The suggestion preserves condition order, short-circuit evaluation, and the
inner body. It is withheld if any comment lies inside the outer conditional,
so comments cannot be silently lost. No autofix; separate guards can be useful
organization. Additional statements, `elseif`, and `else` prevent matching.
Macro payloads and quoted code are skipped.

Fallbacks for unknowables: no name resolution is needed. Imports/includes/eval
and operator overloads are not evaluated. This is a syntax simplification, not
an effect analysis or a claim that the original code is incorrect. Low shortlist
FP risk refers to the pattern; this style preference remains opt-in.
