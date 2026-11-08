# Round 3, slice 3

Each commit is identified by its unique Git revision search expression (`:/subject`). New rules stay outside recommended; registry files are generated. No scope or module-resolution changes.

Measurement: ESLint Linter with clone cwd, absolute original filenames and a normalized root-based flat config so external files are not silently ignored; exactly one new rule enabled per pass. All three requested depots were set. Inputs: 2,518 sample files, 139 Pluto files and 13 Malt files (recursive current checkout). Eight sample files and four Pluto files have fatal parse errors and contribute no rule findings. Classification reads up to ten reported locations per rule across the three sets; zero findings gives no precision evidence. TP means useful advisory, not demonstrated speedup.

| Rule | Commit | Tests (Node 22 / 24) | Corpus / Pluto / Malt | TP / FP / debatable | Edit | Recommendation and evidence |
| --- | --- | --- | --- | --- | --- | --- |
| prefer-sized-push-buffer | `:/Implement prefer-sized-push-buffer` | 17 RuleTester cases; full suite 1069 / 1069 pass | 1 / 0 / 0 | 0 / 1 / 0 | suggestion | strict-only: Julia `test/llvmpasses/pipeline-o0.jl:33` deliberately exercises array allocation and GC roots; changing its workload is unhelpful. Reservation is optional performance policy. |
| no-full-slice-in-consumer | `:/Implement no-full-slice-in-consumer` | 13 RuleTester cases; full suite 1082 / 1082 pass | 0 / 0 / 0 | 0 / 0 / 0 | length-only suggestion | strict-only: snapshot, flattening and reduction semantics require review; no observed matches establish precision. |
| no-collect-before-range-iteration | `:/Implement no-collect-before-range-iteration` | 16 RuleTester cases; full suite 1098 / 1098 pass | 0 / 0 / 0 | 0 / 0 / 0 | suggestion | strict-only: allocation advice for literal ranges, not a likely bug; no observed matches establish precision. |
| no-string-growth-in-loop | `:/Implement no-string-growth-in-loop` | 17 RuleTester cases; full suite 1115 / 1115 pass | 0 / 0 / 0 | 0 / 0 / 0 | none | strict-only: possible prefix-copying cost, with adjacent initialization and no intermediate observations; no observed matches establish precision. |
| no-concat-growth-in-loop | `:/Implement no-concat-growth-in-loop` | 17 RuleTester cases; full suite 1132 / 1132 pass | 0 / 0 / 0 | 0 / 0 / 0 | none | strict-only: repeated prefix copying can be deliberate for type promotion, shape or aliases; no observed matches establish precision. |
