import { tester, plugin } from '../helpers.js';
tester.run('no-unsafe-finally', plugin.rules['no-unsafe-finally'], {
  valid: [
    'try work(); finally close_resource(); end',
    'try work(); finally for i in 1:3; break; end; end',
    'try work(); finally while ready; continue; end; end',
    'function f(); try return 1; finally println("cleanup"); end; end',
    'try work(); finally function f(); return 2; end; end',
    'try work(); finally f = x -> return x; end',
    'try work(); finally map(xs) do x; return x; end; end',
    'function f(); try x(); finally @m return 1; end; end',
    'quote try work(); finally return; end end',
    'function f(); try x(); catch; return 1; end; end',
  ],
  invalid: [
    {
      code: 'function f(); try return 1; finally return 2; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'for i in 1:3; try work(); finally break; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'for i in 1:3; try work(); finally continue; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function f(); try error("failed"); finally return 0; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function f(xs); for x in xs; try println(x); finally break; end; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function f(xs); for x in xs; try println(x); finally continue; end; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function 🐱(); try α(); finally if ok; return 0; end; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'try x(); finally for i in xs; try y(); finally break; end; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function f(); try x(); finally while ready; return; end; end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
  ],
});
