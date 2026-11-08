import { tester, plugin } from '../helpers.js';
const bad = (code) => ({ code, errors: [{ messageId: 'precision' }] });
tester.run(
  'no-loss-of-float-integer-precision',
  plugin.rules['no-loss-of-float-integer-precision'],
  {
    valid: [
      '9007199254740993',
      '16777216f0',
      '9007199254740992.0',
      '9007199254740994.0',
      '1.25',
      '1e30',
      '16777217f1',
      '0x1.01p30',
      'big"9007199254740993.0"',
      '@foo 9007199254740993.0',
      'quote 9007199254740993.0 end',
      { code: `${'9'.repeat(310)}.0`, languageOptions: { recover: true } },
      { code: `${(2n ** 128n).toString()}f0`, languageOptions: { recover: true } },
    ],
    invalid: [
      bad('9007199254740993.0'),
      bad('16777217f0'),
      bad('33554435f0'),
      bad('α = -9_007_199_254_740_993.000'),
      bad('16_777_217.00f0'),
    ],
  },
);
