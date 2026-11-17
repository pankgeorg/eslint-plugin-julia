# no-reassigned-capture

Review captured locals whose reassignment requires a box during Julia lowering.
This is opt-in performance advice. Shared mutable closure state is often
intentional; a finding is not a correctness bug or proof of a runtime slowdown.

```julia
function make_reader(seed)
    state = seed
    reader = () -> state  # reported here, once for state
    state = seed + 1
    reader
end
```

```js
import julia from 'eslint-plugin-julia';
export default [
  {
    files: ['src/**'],
    plugins: { julia },
    language: 'julia/julia',
    rules: { 'julia/no-reassigned-capture': 'warn' },
  },
];
```

There are no options and no fixes or suggestions. Adding `let` automatically
would break closures that must observe subsequent updates.

The checked subset was compared with Julia 1.13.2 `Meta.lower`/`code_lowered`:

- Two explicit assignments to a captured local require `Core.Box`, even if both
  precede the closure. Object mutation (`push!(state, item)`) is not assignment.
- Assignment inside an inner function requires sharing the captured binding.
  Arrow functions, `do` blocks, inner named functions, generator bodies and
  generator filters count as closures. Simple typed comprehensions (including
  comma-separated iterators) lower to loops. Typed comprehensions with filters
  or repeated `for` clauses still create closures. A generator's iterable expressions are
  conservatively excluded; its first iterable executes outside the closure.
- A single assignment before capture is unboxed. Julia 1.13 can also keep a
  function argument unboxed after one unconditional reassignment before capture.
  Reassignment after capture requires boxing. A conditional write before a
  capture outside that branch also requires boxing; a write that dominates all
  captures within its own branch can remain unboxed.
- `for` iteration variables are fresh each iteration, so merely capturing one
  does not warn. Reassigning it after capture does warn.
- `let state = state` creates a distinct binding. A closure over that new,
  unreassigned binding does not warn. Reassigning the new binding can still box it.

```julia
reader = let state = state
    () -> state
end
```

Use that rewrite only when taking a snapshot is correct. A variable type
annotation can improve inference of boxed contents, but does not remove sharing
or necessarily remove the box. Later compiler optimization may eliminate an
allocation, so check the hot path with `@code_lowered` and `@code_warntype`.
See Julia's [performance tips on captured variables](https://docs.julialang.org/en/v1/manual/performance-tips/#man-performance-captured).

Limitations: this deliberately does not reproduce all of Julia's lowering. It
skips quoted code, macro payloads, and bindings with opaque macro uses/writes.
Globals, constants, recursive function-name bindings, dynamic evaluation and
additional boxing caused by use before a sole initialization are outside its
scope. It reports the first written capture per binding, even if several closures
share it. Syntax-level assignments, not execution counts, determine the warning.
Compiler versions and macros may change the final generated code.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "closure capture by reference"
