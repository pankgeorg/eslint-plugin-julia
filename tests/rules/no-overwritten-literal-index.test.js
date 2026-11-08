import { tester, plugin } from '../helpers.js';
tester.run('no-overwritten-literal-index', plugin.rules['no-overwritten-literal-index'], {
  valid: [
    'function f(a); a[1]=1; a[1]=2; end',
    'function f(); a=[0]; a[1]=1; consume(a); a[1]=2; end',
    'function f(); a=[0,0]; a[1]=1; a[2]=2; end',
    'function f(); a=Int[0]; a[1]=1; a[1]=2; end',
    'function f(); a=[0]; a[2]=1; a[2]=2; end',
    'function f(); a=[0]; a[1]=foo(); a[1]=2; end',
    'function f(); a=[0]; g()=a; a[1]=1; a[1]=2; end',
    '@m function f(); a=[0]; a[1]=1; a[1]=2; end',
    'quote function f(); a=[0]; a[1]=1; a[1]=2; end; end',
    'function f(); if p; a=[0]; a[1]=1; a[1]=2; end; end',
    'a=[0]; a[1]=1; a[1]=2',
  ],
  invalid: [
    {
      code: 'function f(); a=[0,0]; a[1]=1; a[1]=2; return a; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: 'function f(); a=[0,0]; a[2]=3; a[2]=4; consume(a); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: 'function f(); α=[0]; α[1]=5; α[1]=6; return α[1]; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
  ],
});
