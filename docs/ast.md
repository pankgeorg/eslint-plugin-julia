# AST contract, version 1

This is a JuliaSyntax syntax tree, not ESTree, Julia Expr, or lowered Julia IR.
The contract version is independent of the grammar pinned in `wasm/manifest.json`.
All fields, children, tokens, and diagnostics are read-only to consumers. Objects
are acyclic; parents live in a WeakMap accessed by `sourceCode.getParent(node)`.
Production does not deep-freeze the tree; tests run every rule on frozen objects.

The root has `type` and `kind` equal to `JuliaFile`, `children` in source order,
`range`, `byteRange`, and `loc`. It has no parser kind ID, flags, class, value, or
interior field. Its range covers the full supplied string. Preserve `toplevel`
containers beneath it, including nested semicolon groups. The external zero-width
parser sentinel is absent from roots.

Parser nodes have `type === kind` (JuliaSyntax kind name), `interior: boolean`,
`children`, `range`, `byteRange`, and `loc`. Leaves have exact source `value` and
`originalKind`, which records the token kind before parser remapping. For example,
`x == nothing` is an infix `call` with three `Identifier` children; the middle
leaf's `value` and `originalKind` are `==`. Values are neither evaluated nor
Unicode-normalized. Nonterminal containers, including TOMBSTONE containers,
survive. Leaves omit trivia and TOMBSTONEs, but preserve error leaves even when
flagged as trivia. All raw leaves advance byte offsets before this filtering.

**Unstable raw fields:** `kindId`, `originalKindId`, `flags`, `class`, and precise
JuliaSyntax container shapes are tied to this grammar artifact. Retained raw
nodes in debug parses are internal inspection output, not public AST API. Rules
should use kind names and the tested kind-aware helpers exported through
`eslint-plugin-julia/ast`. `semanticChildren` returns the node's filtered children;
`getOperatorToken` handles infix and prefix-operator calls. Helpers do not infer
bindings or lowered semantics. Kind-specific bits must never be read globally.

`range` is a half-open, zero-based UTF-16 interval, suitable for ESLint fixers.
`byteRange` is the equivalent half-open UTF-8 interval, unsuitable for fixers.
`loc.start/end` have 1-based lines and 0-based UTF-16 columns. CRLF counts as one
line break; CR and LF also break lines. Byte positions inside a UTF-8 sequence map
to the beginning of the code point. Inclusive 1-based diagnostic bytes convert
as `[firstByte - 1, lastByte]` before mapping, clamped at EOF; insertion errors
remain zero-width. ESLint strips a leading BOM before calling the language and
restores it when applying fixes. Direct internal parser calls retain a BOM in
their coordinates.

For `α = √2; 🐱 == nothing`, `==` has `range: [11, 13]`; ESLint's report column is
12. The file is longer in UTF-8 bytes than in UTF-16 code units.

SourceCode extends plugin-kit's TextSourceCodeBase, exposing `text`, `lines`,
`ast`, text/location conversion methods, `getAncestors`, and iterative traversal.
It also exposes:

- `tokens`: positive-width leaves including punctuation/keywords, excluding
  whitespace, comments, and TOMBSTONE leaves. Non-trivia tokens **are the AST leaf
  objects**, so identity comparisons work. Error tokens may be included.
- `comments`: separate exact-text Comment tokens, including `#` or `#= … =#`.
- `getParent(token)`: works for semantic leaves, punctuation/keywords, and comments.
  It returns raw syntax ownership, not a heuristic comment attachment.
- `getTokenBefore(node, { includeComments: false })`: the last token whose end is
  at or before the node's start. Returns null at the beginning.
- `getTokenAfter(node, { includeComments: false })`: the first token whose start
  is at or after the node's end. Returns null at EOF. Both helpers use binary
  search; for zero-width ranges, tokens sharing the boundary qualify.
- `diagnostics`: all JuliaSyntax diagnostics independent of rule settings, with
  `message`, `level` (1 error, 2 warning, 3 other), ranges, and locations.
- `provenance`: the parser manifest. `visitorKeys`: a per-file kind table with
  `children` as each kind's visitable field.

No getScope, ESTree tokens, or JavaScript control-flow analysis is provided.
Keyword tokens and interior nodes can share kinds such as `for` and `catch`;
check `interior` before interpreting a construct.

Selectors can use `call`, `struct`, `Identifier`, and attribute selectors for
punctuation. For example, `[kind="."]`, `[kind="::"]`, or
`call > Identifier[originalKind="+"]`. Bare `.` and `+` are ESQuery syntax, not
safe node selectors.

The internal test normal form ports `jlparse.rs::sem_tree`: omit trivia, retain
leaf text and meaningful flags, equate operator/identifier symbols by text, splice
`toplevel` inside `toplevel`, and ignore its semicolon bit. It also compares
comments with trailing whitespace trimmed. The identity rewrite intentionally
changes the operator and is tested for exactly that delta; it is not claimed to
preserve Julia semantics when equality is overloaded.

The optional `eslint-plugin-julia/scope` entry point exposes `getScopeManager(sourceCode)`
(cached by SourceCode identity), `resolve(identifierNode)`, `isReadReference(node)` and
`isUnshadowedBuiltin(node, name)`. Call `getScopeManager` before standalone helpers.
Managers expose `scopes`, `definitions`, `references`, `functions`, `imports`, `exports`,
`scopeFor`, `definitionFor`, `referenceFor`, `lookup`, and the same helpers. Binding
objects carry declaration, write and resolved-read records. This is a syntactic,
single-file model, not Julia lowering or inference.

All bindings are collected before resolving reads. Nested local assignments reuse
an enclosing local; explicit local/argument/let/iteration/catch/type-parameter
bindings create locals. File soft scopes create locals rather than update globals.
Modules isolate their globals; baremodules inherit Core only. Let headers and
iteration clauses evaluate against earlier bindings; defaults see earlier arguments.
Properties, keyword labels, named-tuple keys and struct fields are not reads.
Exact `var"..."` contents are supported without decoding escape sequences or Unicode
normalization. Quotes are data except interpolation at the matching quote depth.
Macro names are excluded; written arguments can be reads and written ordinary Julia
constructs can bind names, but expansion never supplies bindings. Opaque macro
operands are marked for diagnostic rules to suppress. Includes/eval and bare using
are recorded as dynamic information; they never invent definitions. The Base/Core
inventory is pinned to Julia 1.13.2. Rules document their own uncertainty policies.
