import { tester, plugin } from '../helpers.js';
tester.run('no-empty-literal-range', plugin.rules['no-empty-literal-range'], {
  valid: [
    'for i in 1:5; use(i); end',
    'for i in 5:-1:1; end',
    '[i for i in 2:2]',
    '[i for i in 1:0:5]',
    '[i for i in n:1]',
    'r = 5:1',
    '@m [i for i in 5:1]',
    'quote for i in 5:1; end; end',
    'f(var":") = [i for i in 5:1]',
    '[i for i in 0xffffffff:1]',
    '[i for i in 2147483648:1]',
  ],
  invalid: [
    {
      code: '[α for α in 5:1]',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: 'for i in 1:-1:5; use(i); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: '[i for i in 5:2:1]',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: '[i for i in -1:-3]',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
  ],
});
