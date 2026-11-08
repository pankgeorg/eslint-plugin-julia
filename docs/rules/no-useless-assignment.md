# no-useless-assignment

Reports the first of two adjacent direct stores of small integer or Bool literals
to the same untyped, uncaptured function local, when that binding is read later.
For example, `x = 0; x = 1; return x` never uses the first value.

No options. Both values must be Bool or integer literals in signed 32-bit range.
Globals, typed/declared locals, properties, indices, nested control-flow regions,
functions with dynamic macros, captures and opaque references are excluded.
Quoted code and opaque macros are skipped. Unknown binding information means skip.
This is a bounded statement-pair check, not general control-flow dead-store analysis;
intentional scaffold initialization can still be reported.

Offers a suggestion to remove the first assignment when there are no comments
between the stores. No automatic fix: review the intended initialization. Deletion
preserves the next store and does not remove any effectful right-hand side.
