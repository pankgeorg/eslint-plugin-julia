# Security

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/pankgeorg/eslint-plugin-julia/security/advisories/new),
not in public issues. You should get a reply within a week.

What the plugin does when ESLint runs it:

- It reads the files ESLint lints. For module resolution it also reads `Project.toml`,
  `Manifest.toml`, `include`d files, and package sources in the Julia depot
  (`JULIA_DEPOT_PATH`, or `~/.julia`).
- It never runs Julia, never evaluates the code it lints, starts no processes, and makes
  no network requests.
- The bundled `wasm/parser.wasm` has no imports. Its SHA-256 is checked against
  `wasm/manifest.json` every time the plugin loads.

Only the latest release is supported.
