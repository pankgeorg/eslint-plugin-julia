import { tester, plugin } from '../helpers.js';
tester.run('no-duplicate-logical-operands', plugin.rules['no-duplicate-logical-operands'], {
  valid: [
    'if poll() && poll(); work(); end',
    'x == x',
    'if a && poll() && a; work(); end',
    'a.b || a.b',
    'xs[1] && xs[1]',
    '@m a && a',
    'quote a || a end',
    'a && (b || a)',
  ],
  invalid: [
    {
      code: 'a && a',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'x || y || x',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function f(); α || β || α; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if ready && ready; start(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'remove',
              output: 'if (ready); start(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'while retry || retry; step(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'remove',
              output: 'while (retry); step(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: '(ready && (ready && valid)) ? yes() : no()',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'remove',
              output: '((ready) && (valid)) ? yes() : no()',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if a || b || a; work(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'remove',
              output: 'if (a) || (b); work(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if (a) && a; work(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'remove',
              output: 'if (a); work(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if a && # comment\na; work(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [],
        },
      ],
      output: null,
    },
  ],
});
