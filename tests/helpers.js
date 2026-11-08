import { RuleTester, ESLint } from 'eslint';
import { describe, it } from 'node:test';
import plugin from '../src/index.js';
RuleTester.describe = describe;
RuleTester.it = it;
export const tester = new RuleTester({ plugins: { julia: plugin }, language: 'julia/julia' });
export function engine(rules = {}, extra = {}, languageOptions = {}) {
  return new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.jl'],
        plugins: { julia: plugin },
        language: 'julia/julia',
        languageOptions,
        rules,
      },
    ],
    ...extra,
  });
}
export { plugin };
