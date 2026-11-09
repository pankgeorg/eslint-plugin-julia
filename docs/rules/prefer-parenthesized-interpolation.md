# prefer-parenthesized-interpolation

Make the boundary of a bare interpolation explicit. This is an opt-in style/review
rule; literal suffixes are often intentional, especially `"$file.jl"`.

```julia
"$record.name"       # prints record, followed by literal .name
"$(record).name"     # same value, explicit boundary
"$(record.name)"     # prints the property instead
```

JuliaSyntax parses `"$a[1]"` as interpolation of `a` plus literal `[1]`, and
`"$f(x)"` as interpolation of `f` plus literal `(x)`. The rule recognizes these
suffixes and `.identifier`, including chained accesses and Unicode names.

```js
import julia from 'eslint-plugin-julia';
export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: {
      'julia/prefer-parenthesized-interpolation': [
        'warn',
        {
          mode: 'ambiguous', // default; alternatively 'always'
          commands: true, // default
        },
      ],
    },
  },
];
```

In `ambiguous` mode there is no autofix. Two suggestions let you preserve the
literal suffix or include the apparent property/index/call expression inside the
interpolation. The second changes the value and requires review. Only suffixes
that parse as an expression are reported. In `always` mode every bare identifier
gets a safe autofix, such as `"hello $name"` → `"hello $(name)"`.

Command literals also support bare identifiers, but have a separate shell-like
grammar: single quotes and escaped dollars suppress interpolation. In a command,
`$a[1]` without shell quotes is rejected during macro expansion; `"$a[1]"` inside
a command has the same literal suffix ambiguity as a string. The rule skips
parenthesized command atoms and stops scanning at other nonidentifier atom forms.
Set `commands: false` to check only strings.

Raw/regex and other nonstandard string/command macros own their interpolation
semantics and are skipped. Ordinary interpolated strings inside macro arguments
are checked. Quoted Julia code, escaped dollars, and already parenthesized
interpolations are skipped. The rule changes spelling, not variable resolution;
local shadows, qualified names, and imports do not affect the boundary.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "string interpolation"
