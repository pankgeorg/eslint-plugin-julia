import { tester, plugin } from '../helpers.js';
tester.run('no-collapsible-if', plugin.rules['no-collapsible-if'], {
  valid: [
    'if a; if b; work(); else wait(); end; end',
    'if a; prepare(); if b; work(); end; end',
    'if a; if b; work(); end; else wait(); end',
    'if a; if b; work(); elseif c; wait(); end; end',
    '@m if a; if b; work(); end; end',
    'quote if a; if b; work(); end; end end',
  ],
  invalid: [
    {
      code: 'if a; if b; work(); end; end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'combine',
              output: 'if (a) && (b); work(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if ready(); if permitted(); start(); end; end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'combine',
              output: 'if (ready()) && (permitted()); start(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'function f(a, b); if a; if b; return 1; end; end; 0; end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'combine',
              output: 'function f(a, b); if (a) && (b); return 1; end; 0; end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if α; if 🐱; β(); end; end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'combine',
              output: 'if (α) && (🐱); β(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if a\n    if b\n        work()\n    end\nend',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'combine',
              output: 'if (a) && (b)\n        work()\n    end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if a; # outer\nif b; work(); end; end',
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
