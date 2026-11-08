import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(readFileSync(new URL('../wasm/manifest.json', import.meta.url)));
const bytes = readFileSync(new URL('../wasm/parser.wasm', import.meta.url));
assert.equal(bytes.length, manifest.bytes);
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
const module = new WebAssembly.Module(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), []);
assert.deepEqual(
  WebAssembly.Module.exports(module)
    .map((e) => e.name)
    .sort(),
  [...manifest.abi.exports].sort(),
);
assert(WebAssembly.Module.exports(module).every((e) => e.kind === 'function'));
const { parseJulia } = await import('../src/parser/syntax-tree.js');
assert.equal(parseJulia('α = 1').diagnostics.length, 0);
console.log(
  `Verified ${bytes.length} bytes, ${manifest.abi.exports.length} ABI exports, Wasm GC/EH smoke parse (${process.version}).`,
);
