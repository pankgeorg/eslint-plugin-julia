# no-collect-before-range-iteration

Review `for i in collect(1:100)` and stepped/descending variants. A direct integer range has constant-size representation; collecting it allocates and initializes an array before iteration. Iterate the range directly when materialization is unnecessary.

```julia
for i in collect(20:-1:1) # Consider: for i in 20:-1:1
    consume(i)
end
```

There are no options. Only normal `for` iterators, resolved Base `collect` and range operators, and signed machine-sized integer literals are supported. Zero steps, computed bounds, arbitrary iterators, character/float ranges, stored arrays, comprehensions, keywords, splats, shadowed builtins, macro payloads and quoted code are excluded. Snapshot iteration such as `collect(keys(d))` may be essential when mutating a dictionary.

A reviewed suggestion replaces the immediate collect expression with its range, preserving a single evaluation and grouping. Suggestions are suppressed when replacement would remove comments; there is no autofix. Materialization can intentionally change resource use or error timing, so retaining it or disabling this opt-in rule is a valid fallback. The rule neither evaluates user code nor unrolls ranges.
