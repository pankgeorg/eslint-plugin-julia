# Project policies with configurable rules

A project can ask reviewers to inspect particular APIs without treating every use
as a Julia bug. `julia/no-restricted-calls`, `julia/no-restricted-macros` and
`julia/no-restricted-imports` start with empty restriction lists. Enable only the
entries that express your project's conventions. Structural conventions use ESLint
core `no-restricted-syntax` on JuliaSyntax nodes; see [restricted-syntax.md](restricted-syntax.md)
for selector details. Import options are documented under [no-restricted-imports](rules/no-restricted-imports.md).

The following complete flat config is an illustrative bundle, not a shipped preset.
Comments name the related ReLint checks so that each policy can be considered on
its own. Messages and Julia examples are independently written. A restriction is
a review request, not a claim that the operation is universally incorrect.

```js
// eslint.config.js
import julia from 'eslint-plugin-julia';

const calls = [
  { name: 'Core.ccall', message: 'Review the foreign interface contract.' }, // ccall
  { name: 'Base.finalizer', message: 'Review cleanup ownership.' }, // finalizer
  { name: 'Base.unlock', minArgs: 1, maxArgs: 1, message: 'Review this manual lock release.' }, // unlock
  { name: 'Base.yield', minArgs: 0, maxArgs: 0, message: 'Review this scheduler handoff.' }, // yield
  { name: 'Base.sleep', minArgs: 1, maxArgs: 1, message: 'Use the application delay abstraction.' }, // sleep
  { name: 'Core.Task', minArgs: 1, maxArgs: 1, message: 'Use the application task launcher.' }, // Task
  { name: 'Core.ErrorException', message: 'Choose a domain exception.' }, // ErrorException
  { name: 'Base.error', message: 'Choose a domain exception.' }, // error
  {
    name: 'Threads.nthreads',
    context: 'const-initializer',
    maxArgs: 0,
    message: 'Query thread counts during runtime work.',
  }, // initializing with `nthreads`
  {
    pattern: 'unsafe_*',
    binding: 'spelling',
    exceptWithinFunctions: ['unsafe_*', '_unsafe_*'],
    message: 'Keep this call within the low-level API boundary.',
  }, // unsafe_ function
  {
    pattern: '_unsafe_*',
    binding: 'spelling',
    exceptWithinFunctions: ['unsafe_*', '_unsafe_*'],
    message: 'Keep this call within the low-level API boundary.',
  }, // unsafe_ function
  { pattern: 'Base.uv_*', message: 'Review the runtime interface.' }, // uv
];

const macros = [
  { name: 'Base.@cfunction', message: 'Review callback lifetime.' }, // @cfunction
  { name: 'Base.@inbounds', message: 'Review the bounds argument.' }, // @inbounds
  { name: 'Threads.@threads', message: 'Review loop concurrency.' }, // @threads
  { name: 'Base.@sync', message: 'Review task synchronization.' }, // @sync
  { name: 'Base.@async', message: 'Use the application task launcher.' }, // @async
  { name: 'Base.@generated', message: 'Review generation-time dependencies.' }, // @generated
  { name: 'Base.@show', message: 'Use structured application diagnostics.' }, // show
];
// To restrict only a scheduler, replace the blanket @threads entry with:
// { name: 'Threads.@threads', when: { argumentIndex: 0, argumentText: ':static' },
//   message: 'Use the approved scheduler.' } // static threads

// Core selectors inspect written structure. These suffixes skip quoted data and
// opaque macro payloads; they do not expand macros or infer runtime types.
const ordinary = ':not(quote *):not(inert *):not(macrocall *)';
const syntax = [
  {
    selector:
      `:matches(call, dotcall) > [kind='...']${ordinary}` +
      ":not(function > call > [kind='...'])" +
      ":not(function > [kind='where'] > call > [kind='...'])" +
      ":not(function > [kind='::'] > call > [kind='...'])" +
      ':not(macro *)',
    message: 'Review argument expansion.',
  }, // splatting
  {
    selector: `function > [kind='::']${ordinary}, function > [kind='where'] > [kind='::']${ordinary}`,
    message: 'Review the method result conversion.',
  }, // return type annotation
  {
    selector: `call:has(> Identifier[value='*']):has(> string)${ordinary}`,
    message: 'Use the application string formatting convention.',
  }, // string concatenation
  {
    selector: `:matches([kind='->'], [kind='do']) > block > return:last-child${ordinary}`,
    message: 'Follow the closure return convention.',
  }, // return in anonymous function
];

export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: {
      'julia/no-restricted-calls': ['warn', { entries: calls }],
      'julia/no-restricted-macros': ['warn', { entries: macros }],
      'julia/no-restricted-imports': [
        'warn',
        {
          banImport: true, // no import
          requireExplicitNames: true, // bare using
          entries: [{ module: 'RAICode', kind: 'using', message: 'Respect the package boundary.' }], // no import RAICode
        },
      ],
      'no-restricted-syntax': ['warn', ...syntax],
    },
  },
  {
    files: ['src/Compiler/**/*.jl'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        ...syntax,
        {
          selector: `vect[children.length=0]${ordinary}`,
          message: 'Specify the container element type.',
        }, // array with no specific type
        {
          selector: `comprehension${ordinary}`,
          message: 'Specify the comprehension element type.',
        }, // untyped array comprehension
      ],
    },
  },
  {
    files: ['test/**/*.jl', 'test.jl', 'tests.jl'],
    rules: {
      // Explicit policy replacement: tests may use delays and generic exceptions.
      'julia/no-restricted-calls': [
        'warn',
        {
          entries: calls.filter(
            (entry) => !['Base.sleep', 'Base.error', 'Core.ErrorException'].includes(entry.name),
          ),
        },
      ],
      'julia/no-restricted-imports': [
        'warn',
        {
          banImport: true, // no import: retained in tests
          entries: [{ module: 'RAICode', kind: 'using', message: 'Respect the package boundary.' }], // no import RAICode: retained
          // bare using: allowed in tests by omitting requireExplicitNames
        },
      ],
      // splatting, string concatenation, return type annotation, and
      // return in anonymous function: allowed in tests.
      'no-restricted-syntax': 'off',
    },
  },
];
```

Names such as `Core.ccall` are canonical policy identities; they are not instructions
to rewrite Julia source with those qualifications. Resolved entries recognize
unshadowed builtins, explicit imports and aliases, and known wildcard exports.
`Base.sleep`, bare `sleep` and `using Base: sleep as pause; pause(0.2)` match the
same restriction; a local `sleep` does not. Spelling mode is an explicit choice
for naming conventions such as `unsafe_*`. Const-initializer restrictions stop at
nested callable bodies. Calls in macro payloads require `includeMacroPayloads: true`
on the call rule, and nested macro invocations require it on the macro rule.

For a project wrapper policy, add entries using your actual module paths. For
example, these optional entries illustrate checks whose APIs are project specific:

```js
const projectCalls = [
  { name: 'Deployment.is_local_deployment', context: 'const-initializer' }, // initializing with `is_local_deployment`
  { name: 'PageStore.remove_page', minArgs: 2, maxArgs: 2 }, // remove_page
  { name: 'Base.in', minArgs: 2, maxArgs: 2 }, // in
  { name: 'Base.∈', minArgs: 2, maxArgs: 2 }, // in (the operator spelling)
  { name: 'Base.haskey', minArgs: 2, maxArgs: 2 }, // haskey
  { name: 'equal', binding: 'spelling', minArgs: 2, maxArgs: 2 }, // equal
  { name: 'ProjectPaths.RelPath', minArgs: 1, maxArgs: 2 }, // RelPath (constructors)
  { name: 'ProjectPaths.split_path', minArgs: 1, maxArgs: 1 }, // RelPath split_path
  { name: 'ProjectPaths.drop_first', minArgs: 1, maxArgs: 1 }, // RelPath drop_first
  { name: 'ProjectPaths.relpath_from_signature', minArgs: 1, maxArgs: 1 }, // RelPath relpath_from_signature
];
// In the relevant files override, set entries: [...calls, ...projectCalls].
```

These paths are placeholders requiring matching imports or known origins. The
`RelPath` annotation boundary needs a structural selector as described in
[restricted-syntax.md](restricted-syntax.md); a call rule covers constructors only. Private logging
redaction and assertion contracts require project rules. Neither a name restriction
nor a selector proves that data is safe to log. For a general TODO reminder, core
`no-warning-comments` can express the related `TODO` check; a tracker-specific
`TODO PR` convention requires a project comment check.

Flat-config arrays replace rule options rather than append entries; explicitly
spread lists when an override should retain previous restrictions. Each rule has
one severity per config block, so messages explain individual policies while files
overrides choose enforcement scope. Directory globs use actual directory boundaries.
The selector examples are deliberately structural: exotic signature wrappers can
need further exclusions, multiplication selects direct string operands only, and
comprehensions are matched without type inference. They express review conventions,
not complete semantic equivalence with another linter.

See [no-restricted-calls](rules/no-restricted-calls.md),
[no-restricted-macros](rules/no-restricted-macros.md), [no-restricted-imports](rules/no-restricted-imports.md), and
[restricted-syntax.md](restricted-syntax.md) for detailed options and limitations.
