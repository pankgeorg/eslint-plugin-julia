# no-time-in-library

Report resolved Base `@time` instrumentation in files explicitly selected as library source. Timing gathers counters and prints a report on execution. Unsolicited output and measurement overhead are often inappropriate in library APIs; the macro does not inherently run its payload twice or prove that it is slow.

```js
// Add this entry to your flat config alongside the Julia plugin/language setup.
{ files: ["src/**/*.jl"], rules: { "julia/no-time-in-library": "warn" } }
```

```julia
f() = @time work() # Review development instrumentation in library source.
```

There are no options or edits. **The rule uses the caller's file selection**; it does not guess which directories are libraries. Configure it on library paths and leave benchmark, test and example trees out. A blanket strict configuration will also report instrumentation in those trees unless overridden.

Qualified `Base.@time` and explicit Base imports/aliases are recognized. Unqualified macro lookup uses the expansion module, not runtime local variables. Custom macros named time, quoted code, strings, comments, macro definitions and nested macro payloads are ignored. Macro expansion is not performed. Other timing macros are outside scope.

Move investigation code to benchmarks, or retain deliberate instrumentation in an explicit diagnostics API and disable this opt-in policy there. Removing the macro or replacing it with logging requires human review of output and timing contracts, so neither autofix nor a mechanical suggestion is supplied.
