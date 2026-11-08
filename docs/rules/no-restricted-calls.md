# no-restricted-calls

Restrict configured function invocations. This is a project policy rule: its default
`entries: []` reports nothing. It does not assert that a restricted operation is a bug.
There are no fixes or suggestions because replacing a call can change its behavior.

```js
import julia from 'eslint-plugin-julia';
export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: {
      'julia/no-restricted-calls': [
        'warn',
        {
          entries: [
            {
              name: 'Base.sleep',
              minArgs: 1,
              maxArgs: 1,
              message: 'Use the project delay wrapper.',
            },
            {
              name: 'Threads.nthreads',
              context: 'const-initializer',
              message: 'Read the thread count during runtime work.',
            },
            {
              pattern: 'unsafe_*',
              binding: 'spelling',
              exceptWithinFunctions: ['unsafe_*', '_unsafe_*'],
              message: 'Keep this operation inside an approved low-level function.',
            },
          ],
          includeMacroPayloads: false,
        },
      ],
    },
  },
];
```

Each entry requires exactly one of `name` (exact) and `pattern` (glob). `*` matches
zero or more characters except dots; `?` matches one character except a dot. Matching
is anchored, case sensitive and Unicode aware. Without dots, a pattern matches the
callee's basename; a dotted pattern matches its full path. `message` supplies the
project explanation appended to the diagnostic.

`binding` defaults to `"resolved"`. A known builtin name such as `sleep` means
`Base.sleep`. These all match that identity:

```julia
sleep(0.2)
Base.sleep(0.2)
using Base: sleep as pause
pause(0.2)
```

A parameter, local function or value named `sleep` does not match. Neither does
`using Other: sleep`. A local `Base` or `Threads` binding prevents a builtin
qualification from matching. `Threads.nthreads` and `Base.Threads.nthreads` share
an identity; Base reexports of Core names such as `Task` use their Core identity.
Explicit module imports and renamed imports establish provenance without executing
or loading Julia packages. Wildcard imports need an export fact from the module
resolver. Unknown or ambiguous origins are skipped. Basename globs in resolved mode
apply only to known builtin/import origins, not arbitrary local definitions.

`binding: "spelling"` deliberately includes local and unresolved names. An undotted
exact name then matches the written basename, including a qualified call; dotted
names match the written path exactly. Imported aliases use their written alias in
this mode. Use it for naming conventions rather than API identity checks.

`minArgs` and `maxArgs` bound the number of written positional arguments. Keywords
do not count; a do callback counts as one argument. A positional splat makes arity
unknown, so entries with either bound skip that invocation. Without bounds a splat
still matches. Prefix, infix and broadcast forms are checked, and callee type
parameters are ignored (`Task{T}(f)`). Method/macro signatures and function values
passed to another call are not invocations; calls in default argument expressions
are still invocations.

`context` defaults to `"any"`. `"const-initializer"` matches calls evaluated beneath
a const's initializer, including nested eager calls, but stops at function, lambda,
macro definition and do bodies. It does not prove precompilation or runtime effects.
`exceptWithinFunctions` exempts a call inside any lexically enclosing named method
whose basename matches one of the globs. A lambda or do callback supplies no name,
but can inherit an exception from an outer named method. This is a naming boundary,
not a safety proof.

Quoted code (`:(...)` and `quote ... end`) is always skipped. Calls inside macro
payloads are skipped unless `includeMacroPayloads: true`; this inspects written
syntax, not expansion. Arbitrary value aliases, dynamic property lookup, reexport
chains that do not expose the original identity, and locally defined module APIs
are not followed. Policies that need these cases can use explicit spelling mode.
All option objects reject unknown properties.

See [Project policies](../policies.md) for a complete bundle.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) checks "ccall", "finalizer", "unlock", "yield", "sleep", "Task", "ErrorException", "error", "unsafe_ function", "uv", "initializing with `nthreads`"; ESLint `no-restricted-properties`.
