// Lints this repository: its JavaScript with @eslint/js and eslint-plugin-n, and its own
// Julia scripts with the plugin's recommended config (dog-fooding). Test fixtures contain
// deliberate findings and are not linted.
import js from '@eslint/js';
import n from 'eslint-plugin-n';
import globals from 'globals';
import julia from './src/index.js';

export default [
  { ignores: ['tests/fixtures/**', 'wasm/**', 'coverage/**', 'tests/.tmp-*/**'] },
  {
    files: ['**/*.{js,mjs}'],
    ...js.configs.recommended,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: {
      ...js.configs.recommended.rules,
      // `const { fix, ...rest } = descriptor` is how a property is dropped.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  { files: ['**/*.{js,mjs}'], ...n.configs['flat/recommended-module'] },
  { files: ['**/*.jl'], ...julia.configs.recommended },
];
