# Round 3, slice 2

Each measurement enables only the named rule, uses the physical file path, the clone as ESLint cwd, and the full requested depot configuration. Counts are corpus / Pluto / Malt (2,518 / 138 / 13 files). The corpus has 8 fatal parser diagnostics and Pluto has 4; affected files receive no rule analysis. Classification samples read up to ten corpus findings and up to ten project findings. TP for policy rules means the documented pattern applies, not a proven runtime defect. New rules remain outside recommended; recommendations below are evidence for the planner.

| Rule | Commit | Tests | Corpus / Pluto / Malt | Reviewed TP / FP / debatable | Fix kind | Recommendation and evidence |
| --- | --- | --- | --- | --- | --- | --- |
| no-throw-literal | this commit | Node 22 + 24: 1065 pass | 30 / 4 / 0 | 14 / 0 / 0 | string suggestion | strict-only: exception hygiene; 10 sampled corpus string throws and all 4 Pluto string throws apply, but arbitrary thrown objects are legal |

No changes to the shared scope or module-resolution implementation. `scripts/measure-rule.mjs` applies a normalized ESLint config through Linter so external files are analyzed with real paths instead of silently falling outside ESLint's configuration boundary. Rule helpers resolve module facts lazily after a syntax match; suggestions are suppressed if replacing comments.
