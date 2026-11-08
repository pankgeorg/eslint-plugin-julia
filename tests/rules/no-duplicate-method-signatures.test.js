import { tester, plugin } from '../helpers.js';
tester.run('no-duplicate-method-signatures', plugin.rules['no-duplicate-method-signatures'], {
  valid: [
    'f(x::Int)=x; f(x::Float64)=x',
    'module A; f(x::Int)=x; end; module B; f(x::Int)=2x; end',
    'f(x::T) where T=x; f(x::T) where T=x',
    'if flag; f(x)=x; else f(x)=2x; end',
    '@m f(x)=x; @m f(x)=2x',
    'struct X end; X(x)=x; X(y)=y',
    {
      code: 'f(x)=x; f(y)=y',
      options: [
        {
          allowRedefinition: true,
        },
      ],
    },
  ],
  invalid: [
    {
      code: 'f(x::Int)=x; f(y::Int)=2y',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'f(x;scale=1)=x*scale; f(x;offset=0)=x+offset',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'function f(x::String); x; end; f(y::String)=uppercase(y)',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: 'f(x)=x; f(y::Any)=y',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
    {
      code: '🐱(x)=x; 🐱(y)=y',
      errors: [
        {
          messageId: 'diagnostic',
        },
      ],
    },
  ],
});
