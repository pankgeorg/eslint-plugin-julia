import { tester, plugin } from '../helpers.js';
tester.run('no-dupe-elseif', plugin.rules['no-dupe-elseif'], {
  valid: [
    'if a; first(); elseif b; second(); end',
    'if poll(); first(); elseif poll(); second(); end',
    'if x == 1; one(); elseif x == 2; two(); end',
    'if a; first(); elseif mutate(); second(); elseif a; third(); end',
    'if a.b; first(); elseif a.b; second(); end',
    'if xs[1]; first(); elseif xs[1]; second(); end',
    'if a; if a; work(); end; end',
    '@m if a; first(); elseif a; second(); end',
    'quote if a; first(); elseif a; second(); end end',
  ],
  invalid: [
    {
      code: 'if ready; work(); elseif ready; retry(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if a; first(); elseif b; second(); elseif a; third(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if false; work(); elseif false; retry(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if ready; start(); elseif ready; stop(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if x == 1; one(); elseif x == 1; two(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if x > 0; positive(); elseif y > 0; other(); elseif (x > 0); fallback(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'function f(); if α && β; first(); elseif (α && β); second(); end; end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if !α; first(); elseif !α; second(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if a < b < c; first(); elseif a < b < c; second(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if α; first(); elseif #= comment =# (α); second(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
  ],
});
