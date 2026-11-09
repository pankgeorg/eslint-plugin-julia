# Project syntax policies with ESLint core

ESLint's own `no-restricted-syntax` works with the Julia language. There is no
`julia/no-restricted-syntax` rule and no additional selector dependency to install.
Use the unprefixed core rule with selector strings or `{ selector, message }`
objects:

```js
import julia from 'eslint-plugin-julia';
export default [
  {
    files: ['src/**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: {
      'no-restricted-syntax': [
        'warn',
        { selector: 'vect[children.length=0]', message: 'Choose an explicit element type.' },
        { selector: 'macrocall', message: 'Review macro use in this directory.' },
      ],
    },
  },
];
```

These are project policies, not necessarily bugs. Scope them with `files` and
exclude tests or generated code as appropriate. A structural selector does not
resolve bindings: a locally shadowed `Vector{Any}` still matches its spelling.

Julia AST nodes have `type === kind`, a `children` array of semantic children,
and source attributes such as `value` (leaves), `flags`, `range` and `loc`. Node
kinds are JuliaSyntax names, such as `call`, `macrocall`, `vect`, `comprehension`,
`Identifier` and `string`; they are not ESTree names. Every node's visitor key is
`children`. Trivia and delimiters are not semantic children. Thus `:last-child`
means the final expression, even when a trailing comment follows it.

Inspect a snippet **as source text**, not as a filename:

```sh
node scripts/inspect-tree.mjs 'send(xs...)' 'f(x)::Int = x' 'Vector{Any}'
```

Use `[kind='::']`, `[kind='...']`, or `[kind='->']` for punctuation kinds, rather
than escaping them as CSS type names. `[value='Vector']` matches a leaf's source
spelling; `[children.0.value='Vector']` inspects its first semantic child.
`[children.length=0]` tests arity. `>` requires a direct child, a space means a
descendant, `:first-child`/`:last-child` test sibling position, `:matches(...)`
combines alternatives, and `:has(> string)` requires a direct string child.

All selectors below run through the actual core rule and Julia language in
`tests/core-no-restricted-syntax.test.js`, including negative controls. They can
be copied into the `selector` property above.

## Call-site splatting

```text
:matches(call, dotcall) > *[kind='...']:not(function > :first-child *):not(macro > :first-child *)
```

Matches `send(xs...)` and `send.(xs...)`, including calls inside function bodies.
The exclusions prevent rest parameters in function/macro signatures from being
reported. They conservatively exclude all signature descendants, including calls
inside default expressions. Tuple and array construction splats are not call
arguments. This policy does not prove a performance problem.

## Return type annotations

```text
function > *[kind='::']:first-child, function > where:first-child > *[kind='::']:first-child
```

Matches both `f(x)::Int = x` and long-form definitions, plus the usual `where`
wrapper. Argument annotations and body type assertions do not match. Explicitly
nested multiple `where`/parenthesis wrappers may need additional selector arms;
inspect the actual tree before extending a policy.

## String multiplication

```text
call[flags=136][children.1.value='*']:has(> string), call[children.0.value='*']:has(> string)
```

Matches `"key=" * value`, `value * "!"`, and `*("key=", value)`. The pinned parser
uses `flags=136` for an ordinary infix call (interior bit 128 plus infix bit 8);
its operator is the second semantic child. A prefix call's callee is the first.
This prevents `f(*, "text")` from matching. Recheck flags when changing the parser
artifact. Dotted multiplication, nonstandard string macros and variables whose
runtime values happen to be strings are outside this example.

## Untyped array comprehensions

```text
comprehension
```

Matches `[x for x in xs]`, filters, and multiple iterators. Typed comprehensions
(`Int[x for x in xs]`) have a different kind, and generator expressions
(`(x for x in xs)`) are not array comprehensions.

## A terminal return in a do block or arrow function

```text
:matches(do, *[kind='->']) > block:last-child > return:last-child, *[kind='->'] > return:last-child
```

Matches `map(xs) do x; return x; end`, `x -> begin; return x; end`, and
`x -> return x`. It leaves named functions and early returns alone. This example
checks a directly terminal return, not returns inside a terminal `if` or nested
`begin`. Explicit return is valid Julia; this is a readability convention.

## Vector{Any}

```text
curly[children.length=2][children.0.value='Vector'][children.1.value='Any'], curly[children.length=2][children.0.kind='.'][children.0.children.0.value='Base'][children.0.children.1.value='Vector'][children.1.value='Any']
```

Matches the spellings `Vector{Any}` and `Base.Vector{Any}`, including constructor
calls and annotations. It does not establish that these names refer to Base,
resolve import aliases, or cover `Vector{Core.Any}` or `Array{Any,1}`. Add spelling
alternatives only if the project intends that broader policy.

## Quotes, macros and comments

Core traversal sees written syntax inside quotes and macro arguments. It has no
Julia-specific opacity filter. For example, to exclude empty vectors in quoted
code and macro payloads, use:

```text
vect[children.length=0]:not(quote *):not(inert *):not(macrocall *)
```

The same suffix can be appended to each arm of a policy selector. Ordinary Julia
rules may skip those contexts, so do not assume their behavior for a core rule.
Comments are exposed separately by the language, not traversed as AST children;
`no-restricted-syntax` cannot implement a comment-content policy by selecting
`Comment` nodes.

Related: [ESLint no-restricted-syntax](https://eslint.org/docs/latest/rules/no-restricted-syntax) and [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) syntax policy checks.
