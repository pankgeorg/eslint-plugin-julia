# require-typed-global

Suggest a declared type for a rebound module global read inside a function. Untyped mutable globals can prevent useful inference at those reads. This is opt-in performance advice; no type or speedup is inferred.

```julia
counter = 0
function advance()
    global counter += 1
    return counter
end
# Consider declaring global counter::Int = 0 on Julia 1.8 or newer.
```

```js
import julia from 'eslint-plugin-julia';

export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: { 'julia/require-typed-global': ['warn', { allow: ['interactive_state'] }] },
  },
];
```

`allow` defaults to `[]` and contains exact binding names, including Unicode or quoted identifier contents.

The rule considers both implicit module assignments and explicit `global` assignments. A binding must have at least two written assignments, or an assignment inside a function that targets the module binding. It must also be read inside a function body in the same file. This deliberately leaves ordinary script and notebook top-level reassignment alone; a script defining functions that read the global still qualifies. A lone module assignment belongs to `prefer-const-global`, so the rules never report the same binding. A lone assignment inside a function can execute repeatedly and belongs here if the function also reads the global.

`const` bindings and bindings with a written type declaration such as `global counter::Int = 0` are excluded. Local assignments, parameters, imports, type/function definitions, opaque macro payloads, quotes, and references only in signatures are excluded. Mutating an object (`push!(buffer, x)`) does not reassign its binding. Each binding is reported once, at its first assignment.

Facts are limited to written code in one file. Macro expansion, external rebinding, runtime evaluation frequency, dispatch, and whole-program inference are not analyzed. A declaration made elsewhere may already constrain a binding. Heterogeneous dynamic state may be intentional; use `allow` or a files override for it. Typed globals require Julia 1.8 or newer and convert assigned values, so the rule provides no automatic fix or guessed-type suggestion.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "non-const untyped global".
