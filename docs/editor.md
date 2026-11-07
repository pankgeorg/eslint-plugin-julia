# Editor setup (unverified)

The CLI is tested; VS Code extension activation is not. A compatible VS Code
ESLint extension would need `eslint.validate` to include `julia`, flat config in
the correct working directory, and an extension Node runtime supporting Wasm GC
and exception handling. Confirm CLI results first, then test Unicode locations,
disable comments, suggestions, and save actions in the editor. Do not enable
JavaScript core rules for Julia files. See ECOSYSTEM.md for tested boundaries.
