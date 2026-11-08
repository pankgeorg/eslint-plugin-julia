import { tester, plugin } from '../helpers.js';
tester.run('no-cond-assign', plugin.rules['no-cond-assign'], {
  valid: [
    'ready = true; if ready; work(); end',
    'while (item = nextitem()) !== nothing; consume(item); end',
    'if f(a=1); work(); end',
    'if f(;a=1); work(); end',
    'if f(x -> (a=1)); work(); end',
    'if ready; a=1; end',
    'if (v = values[1]; isa(v, T)); work(); end',
    'if let x = source; pred(x); end; work(); end',
    'if begin if cache === nothing; cache=Some(x); end; y=cache.value; y isa T; end; work(); end',
    'if a < (b=2) < c; work(); end',
    'if (v = g[k]) isa Group; work(); end',
    'while (tag = read(io)) ≠ eof; work(); end',
    '(t -= 1) ≤ 0 && return false',
    '(ref = arguments[i]) isa GlobalRef || continue',
    'a && (b = true)',
    'a || (b = 1)',
    'if (a && (b=true)) == true; work(); end',
    '@m if (a=true); work(); end',
    'quote if (a=true); work(); end end',
    {
      code: 'if (ready = true); work(); end',
      options: [
        {
          allowParenthesized: true,
        },
      ],
    },
  ],
  invalid: [
    {
      code: 'if (ready = true); work(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'compare',
              output: 'if (ready == true); work(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'while (running = false); work(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'compare',
              output: 'while (running == false); work(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'result = (ok = true) ? 1 : 2',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'compare',
              output: 'result = (ok == true) ? 1 : 2',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if a && (b = true); work(); end',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'compare',
              output: 'if a && (b == true); work(); end',
            },
          ],
        },
      ],
      output: null,
    },
    {
      code: 'if f((a=1)); work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if begin setup(); ready=true; end; work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if (a += 1); work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if (a .= true); work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if (a .+= 1); work(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
    {
      code: 'if α; work(); elseif f((β=1)); stop(); end',
      errors: [
        {
          messageId: 'issue',
        },
      ],
      output: null,
    },
  ],
});
