import { tester, plugin } from '../helpers.js';
tester.run('prefer-isa', plugin.rules['prefer-isa'], {
  valid: [
    'f(x)=x isa Number',
    'f(x)=typeof(x)===Int',
    'f(typeof,x)=typeof(x)==Number',
    'typeof(x)==1',
    'T<:typeof(x)',
    '@m typeof(x)==Number',
    'quote typeof(x)==Number; end',
    {
      code: 'typeof(x)==Int',
      options: [
        {
          exactTypes: false,
        },
      ],
    },
  ],
  invalid: [
    {
      code: 'f(x)=typeof(x)==Number',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(x)=Base.isa(x, Number)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(x)=Real===typeof(x)',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(x)=Base.isa(x, Real)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(x)=typeof(x)!=AbstractArray',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(x)=!Base.isa(x, AbstractArray)',
            },
          ],
        },
      ],
    },
    {
      code: 'typeof(x)==Int',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'Base.isa(x, Int)',
            },
          ],
        },
      ],
    },
    {
      code: 'typeof(x)<:T',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'Base.isa(x, T)',
            },
          ],
        },
      ],
    },
    {
      code: 'abstract type A end; f(x)=typeof(x)==A',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'abstract type A end; f(x)=Base.isa(x, A)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(🐱)=typeof(🐱)==Number',
      errors: [
        {
          messageId: 'diagnostic',
          suggestions: [
            {
              messageId: 'replace',
              output: 'f(🐱)=Base.isa(🐱, Number)',
            },
          ],
        },
      ],
    },
  ],
});
