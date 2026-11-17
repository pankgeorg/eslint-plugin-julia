# prefer-typed-empty-array

Suggest `T[]` for a stable empty-array binding later filled by a known Base operation. `[]` creates a `Vector{Any}`; an explicit element type can improve storage and inference when a suitable type is known. This rule is opt-in advice, and heterogeneous `Any[]` can be an intentional choice.

```julia
function collect_labels(records)
    labels = []
    for record in records
        push!(labels, record.label)
    end
    return labels
end
# If labels are strings, consider labels = String[].
```

```js
import julia from 'eslint-plugin-julia';

export default [
  {
    files: ['**/*.jl'],
    plugins: { julia },
    language: 'julia/julia',
    rules: { 'julia/prefer-typed-empty-array': 'warn' },
  },
];
```

There are no options. The rule reports only a simple assignment `x = []` (parentheses allowed) with one definition and one write, followed in a containing block by `push!`, `append!`, `pushfirst!`, or `prepend!` on that same binding. Both local and module bindings qualify. Base qualification and explicit Base import aliases work; local shadows do not. The initialization and fill must be in the same function or module, so deferred closure effects do not count. Conditional fills and fills in loops over unknown iterables can qualify; execution is not proven.

The survey's broad screen found 799/191/3 empty literals in the corpus/Pluto/Malt, including expected test results and heterogeneous defaults. The narrower fill trigger leaves comparisons with `[]`, `isempty([])`, `@test f() == []`, unused empties, parameter defaults, and empty arrays only returned or stored without a visible fill alone. It does not infer future writes from a return or storage escape. Explicitly typed bindings and literals, rebindings, macro payloads, quotes, indexed/property initialization, and arbitrary aliases are excluded.

To avoid duplicate advice with `prefer-sized-push-buffer`, a literal integer range loop immediately following initialization is reserved for that rule, even if its iteration count is below that rule's configured threshold. This conservative exclusion also applies when only this rule is enabled. Other fill patterns still receive element-type advice.

The diagnostic asks the author to choose an appropriate `T`. There is no automatic fix or executable ESLint suggestion: inserting a placeholder type would not preserve the program. Changing an element type can also introduce conversions or reject later values; review all uses before editing. No dispatch or interprocedural element-type inference is attempted.

Related: [ReLint.jl](https://github.com/RelationalAI-oss/ReLint.jl) check "array with no specific type".
