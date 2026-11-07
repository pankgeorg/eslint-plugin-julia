# julia/no-empty-catch

Opt-in policy check; no fixes. Reports a catch block with no executable syntax
children, with or without an exception binding. A `nothing` statement is nonempty.
Macros and quoted code are skipped.

```julia
try f(); catch err; end          # reported
try f(); catch; rethrow(); end   # accepted
```

The default is `{ allowComment: false }`: a comment alone remains empty. Set
`['warn', { allowComment: true }]` to accept any comment wholly inside the catch
body, such as `# deliberately ignored`. Comments in the try or finally block do
not count. An ESLint disable directive can also document an exception.

Intentional exception swallowing exists. This is a policy preference, so the rule
is excluded from recommended. The plugin never inserts `rethrow()` automatically.
