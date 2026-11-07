import { language } from './language.js';
import { manifest } from './parser/wasm-host.js';
import parseErrors from './rules/parse-errors.js';
import identity from './rules/prefer-identity-nothing.js';
import structFields from './rules/no-duplicate-struct-fields.js';
import keywordArguments from './rules/no-duplicate-keyword-arguments.js';
import emptyCatch from './rules/no-empty-catch.js';
import shadowedLoopVar from './rules/no-shadowed-loop-var.js';

import noDuplicateMethodSignatures from './rules/no-duplicate-method-signatures.js';

const plugin = {
  meta: { name: 'eslint-plugin-julia', version: `0.1.0+wasm.${manifest.sha256}` },
  languages: { julia: language },
  rules: { 'no-duplicate-method-signatures': noDuplicateMethodSignatures, 'parse-errors': parseErrors, 'prefer-identity-nothing': identity,
    'no-duplicate-struct-fields': structFields, 'no-duplicate-keyword-arguments': keywordArguments,
    'no-empty-catch': emptyCatch, 'no-shadowed-loop-var': shadowedLoopVar },
  configs: {},
};
const config = rules => ({ files: ['**/*.jl'], plugins: { julia: plugin }, language: 'julia/julia', rules });
plugin.configs.recommended = config(Object.fromEntries(['parse-errors', 'no-duplicate-struct-fields',
  'no-duplicate-keyword-arguments', 'no-shadowed-loop-var'].map(n => [`julia/${n}`, 'error'])));
plugin.configs.style = config({ 'julia/prefer-identity-nothing': 'warn', 'julia/no-empty-catch': 'warn' });
plugin.configs.all = config(Object.fromEntries(Object.keys(plugin.rules).map(n => [`julia/${n}`, 'error'])));
export default plugin;
export { JuliaSourceCode } from './source-code.js';
