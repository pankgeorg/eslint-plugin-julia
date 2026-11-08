import { tester, plugin } from '../helpers.js';
tester.run('no-constant-condition', plugin.rules['no-constant-condition'], {
  valid: [
    'while true; break; end',
    'if ready; work(); end',
    'f(x) = x > 0 ? x : 0',
    'if 1 == 1; println(1); end',
    'f() = true && 1',
    'if nothing; work(); end',
    'if missing; work(); end',
    '@static if true; work(); end',
    'quote if false; work(); end end',
    'if "$(x)"; work(); end',
    {
      code: 'x = true ? a : b',
      options: [
        {
          checkTernary: false,
        },
      ],
    },
  ],
  invalid: [
    {
      code: 'if true; work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'value = false ? first() : second()',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'while false; work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if true; println(1); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'f(x) = false ? x : 0',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if 1; println(1); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'while "yes"; break; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if "s"; work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if (false); work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if a; work(); elseif 0; stop(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function 🐱(); if 3.5; α(); end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: "if 'α'; work(); end",
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if 0xff; work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if ""; work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'while true; work(); end',
      options: [
        {
          checkInfiniteLoops: true,
        },
      ],
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'while true; work(); end',
      options: [
        {
          checkWhileTrue: true,
        },
      ],
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
  ],
});
