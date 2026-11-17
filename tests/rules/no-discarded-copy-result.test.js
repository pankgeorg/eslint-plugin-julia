import { tester, plugin } from '../helpers.js';
tester.run('no-discarded-copy-result', plugin.rules['no-discarded-copy-result'], {
  valid: [
    'function f(xs); sort(xs); end',
    'function f(xs); sort!(xs); return xs; end',
    'f(xs)=sort(xs)',
    'f(sort,xs)=(sort(xs);xs)',
    'function f(xs); sort(xs;by=println); xs; end',
    '@m sort(xs)',
    {
      code: 'function f(xs); filter(println,xs); xs; end',
      options: [
        {
          checkCallbacks: false,
        },
      ],
    },
  ],
  invalid: [
    {
      code: 'function f(xs); sort(xs); return xs; end',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'function f(xs); reverse(xs); consume(xs); end',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'function f(xs); unique(xs); return xs; end',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'function f(xs); filter(isodd,xs); return xs; end',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'function f(xs); copy(xs); xs; end',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'function f(🐱); reverse(🐱); 🐱; end',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
  ],
});
