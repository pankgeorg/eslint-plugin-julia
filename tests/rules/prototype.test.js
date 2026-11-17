import { tester, plugin } from '../helpers.js';
const suggestion = (replacement, output) => ({
  messageId: 'replace',
  data: { replacement },
  output,
});
tester.run('prefer-identity-nothing', plugin.rules['prefer-identity-nothing'], {
  valid: [
    'x === nothing',
    'x !== nothing',
    'x == y',
    'x .== nothing',
    'x == nothing == y',
    '==(x,nothing)',
    ':(x == nothing)',
    'quote x == nothing end',
    '@m x == nothing',
    's = "x == nothing"',
    'x == var"nothing"',
    'x == nothing = true',
    'f(x = y == nothing) = x',
  ],
  invalid: [
    {
      code: 'function f(x)\n x == nothing\nend',
      output: null,
      errors: [
        {
          messageId: 'identity',
          suggestions: [suggestion('===', 'function f(x)\n x === nothing\nend')],
        },
      ],
    },
    {
      code: 'x == nothing',
      output: null,
      errors: [
        { messageId: 'identity', column: 3, suggestions: [suggestion('===', 'x === nothing')] },
      ],
    },
    {
      code: 'nothing != x',
      output: null,
      errors: [{ messageId: 'identity', suggestions: [suggestion('!==', 'nothing !== x')] }],
    },
    {
      code: 'α = √2; 🐱 == nothing',
      output: null,
      errors: [
        {
          messageId: 'identity',
          column: 12,
          suggestions: [suggestion('===', 'α = √2; 🐱 === nothing')],
        },
      ],
    },
    {
      code: 'x #= keep =# != nothing',
      output: null,
      errors: [
        { messageId: 'identity', suggestions: [suggestion('!==', 'x #= keep =# !== nothing')] },
      ],
    },
  ],
});
tester.run('parse-errors', plugin.rules['parse-errors'], {
  valid: ['α = √2; 🐱 = 1'],
  invalid: [
    {
      code: 'x = )',
      languageOptions: { recover: true },
      output: null,
      errors: [
        { message: 'unexpected `)`', line: 1, column: 5 },
        { message: 'extra tokens after end of expression', line: 1, column: 5 },
      ],
    },
    {
      code: 'α = √2; 🐱 = )',
      languageOptions: { recover: true },
      errors: [
        { message: 'unexpected `)`', line: 1, column: 14 },
        { message: 'extra tokens after end of expression', line: 1, column: 14 },
      ],
    },
  ],
});
