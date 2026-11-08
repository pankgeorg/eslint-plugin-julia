# no-env-mutation

Review direct writes to Julia's process-wide environment. Changing it can affect other tasks and later child processes. Prefer `withenv("KEY" => "value") do ... end` for a scoped change with restoration; scoped restoration alone does not establish isolation from concurrent tasks. This rule is opt-in and does not prove a race.

```js
import julia from 'eslint-plugin-julia';

export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: { 'julia/no-env-mutation': ['warn', { allowInInit: false }] },
  },
  {
    files: ['**/test/**/*.jl'],
    rules: { 'julia/no-env-mutation': 'off' },
  },
];
```

Test exemptions are project-owned file overrides, not built into the rule.

The rule reports `ENV[k] = v` (including compound and dotted indexed assignments) and direct calls to `delete!`, `pop!`, `get!`, `push!`, `empty!`, `merge!`, and `setindex!` with builtin `ENV` as the first argument. The callback-first `get!(f, ENV, key)` form and `get!(ENV, key) do ... end` are included. A possible insertion by `get!` is enough; the rule cannot tell whether a key exists.

Both ENV and the mutator must be known Base builtins. `Base.ENV`, Base-qualified mutators, and explicit Base import aliases are recognized. Local `ENV` dictionaries, local mutator functions, and shadowed `Base` parameters are excluded. `withenv`, reads, and mutations of unrelated dictionaries are accepted.

`allowInInit` defaults to `false`. When true, it exempts direct code in a module-level, zero-argument method spelled `__init__`, including loops inside that body. A separately declared nested function or callback is not exempt: it may execute later. A local function called `__init__` and an overload with arguments are not module initialization hooks. File scope counts as the containing module.

Macros and quoted code are skipped. General value aliases (`copy = ENV`), indirect calls, arbitrary wrappers, macro expansion, and interprocedural effects are not tracked. No fix is offered: introducing a scoped change can alter behavior and lifetime.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "mutating ENV".
