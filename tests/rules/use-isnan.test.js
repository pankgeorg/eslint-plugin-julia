import { tester, plugin } from '../helpers.js';
tester.run('use-isnan', plugin.rules['use-isnan'], {
  valid: [
    'f(var"==",x)=x==NaN',
    'isnan(x)',
    'isequal(x,NaN)',
    'f(NaN,x)=x==NaN',
    'f(Base,x)=x==Base.NaN',
    '@m x==NaN',
    'quote x==NaN; end',
    'x .== NaN',
    {
      code: 'x === NaN',
      options: [
        {
          identity: false,
        },
      ],
    },
  ],
  invalid: [
    {
      code: 'x == NaN',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'Base.isnan(x)',
            },
          ],
        },
      ],
    },
    {
      code: 'NaN32 != x',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: '!Base.isnan(x)',
            },
          ],
        },
      ],
    },
    {
      code: 'x == Base.NaN16',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'Base.isnan(x)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(x)=x==NaN',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(x)=Base.isnan(x)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(x)=NaN32!=x',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(x)=!Base.isnan(x)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(x)=x==NaN16',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(x)=Base.isnan(x)',
            },
          ],
        },
      ],
    },
    {
      code: 'x === NaN',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'Base.isnan(x)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(🐱)=🐱==NaN',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(🐱)=Base.isnan(🐱)',
            },
          ],
        },
      ],
    },
  ],
});
