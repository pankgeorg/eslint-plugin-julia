# Integration status

Verified here on Linux arm64, Node 22.23.3 and 24.22.1: native ESLint language API,
RuleTester, flat configuration and JS/Julia file separation, directives and unused
directives, UTF-16 reports, operator-only autofixes and suggestions, CLI discovery,
ignores and overrides, stdin filenames, content-cache reuse/invalidation after file
changes, two-worker config loading, and SARIF formatter 3.1.0 accepting results.
The integration test checks a Unicode keyword column; this is not an audit of
SARIF consumers' column interpretation. No report was uploaded.

Works with glue, not validated here: lint-staged hooks, pre-commit hooks,
reviewdog, GitHub annotations, and VS Code ESLint extension activation. The supplied
CI template demonstrates SARIF upload, but repository permissions and code scanning
setup remain the owner's responsibility. The formatter has its own ESLint 8
runtime dependency; the plugin itself uses the root ESLint 10 runtime.

Not supplied by the plugin: a Julia formatter/Prettier printer, inference-based
checks like JET.jl, a language server, macro expansion, or JavaScript rule semantics.
No editor, platform-matrix, or 25k-file false-positive audit has been completed.
The recommended rules are the explicitly requested v0.1 candidates; wider release
recommendations still require that audit. No experimental scope/unused-local pass
is included in this core-and-first-rules task.
