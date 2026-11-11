# Security

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/pankgeorg/eslint-plugin-julia/security/advisories/new),
not in public issues. You should get a reply within a week.

What the plugin does when ESLint runs it:

- It reads the files ESLint lints. For module resolution it also reads `Project.toml`,
  `Manifest.toml`, `include`d files, and package sources in the Julia depot
  (`JULIA_DEPOT_PATH`, or `~/.julia`). `no-orphan-file` also lists the package's
  directories and reads its `.jl` files, shell scripts and CI configuration.
- It never runs Julia and never evaluates the code it lints.
- By default it starts no processes and makes no network requests. The opt-in environment
  resolver (`settings.julia.pkgjl`, see `docs/environment-resolver.md`) does: it starts a
  Node child process that imports the configured backend, downloads a registry and the
  package sources the linted repository's Project and Manifest name, and writes to its cache
  directory. Enable it only on repositories you trust.
- The bundled `wasm/parser.wasm` has no imports. Its SHA-256 is checked against
  `wasm/manifest.json` every time the plugin loads.

Only the latest release is supported.
