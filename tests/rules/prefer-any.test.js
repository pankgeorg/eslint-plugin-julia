import { tester, plugin } from '../helpers.js';
tester.run('prefer-any', plugin.rules['prefer-any'], {
  valid: [
    'count(isodd,xs) > 1',
    'length(filter(p,xs)) > 0',
    'filter(p,xs)',
    'count("a",s) > 0',
    'count(r"a",s) > 0',
    'f(count)=count(p,xs)>0',
    '@m count(p,xs)>0',
    'quote isempty(filter(p,xs)); end',
    'count(p,xs; init=1)>0',
    'f(filter)=isempty(filter(p,xs))',
    'f(isempty)=isempty(filter(p,xs))',
  ],
  invalid: [
    {
      code: 'count(isodd, α) > 0',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'replace',
              data: {
                message: 'Use Base.any(isodd, α).',
              },
              output: 'Base.any(isodd, α)',
            },
          ],
        },
      ],
    },
    {
      code: 'count(p, xs) == 0',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'replace',
              data: {
                message: 'Use !Base.any(p, xs).',
              },
              output: '!Base.any(p, xs)',
            },
          ],
        },
      ],
    },
    {
      code: 'isempty(filter(p, xs))',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'replace',
              data: {
                message: 'Use !Base.any(p, xs).',
              },
              output: '!Base.any(p, xs)',
            },
          ],
        },
      ],
    },
    {
      code: '!isempty(filter(p, xs))',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'replace',
              data: {
                message: 'Use Base.any(p, xs).',
              },
              output: 'Base.any(p, xs)',
            },
          ],
        },
      ],
    },
    {
      code: 'count(x -> x == "α", xs) > 0',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'replace',
              data: {
                message: 'Use Base.any(x -> x == "α", xs).',
              },
              output: 'Base.any(x -> x == "α", xs)',
            },
          ],
        },
      ],
    },
    {
      code: '0 != count(p, xs)',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'replace',
              data: {
                message: 'Use Base.any(p, xs).',
              },
              output: 'Base.any(p, xs)',
            },
          ],
        },
      ],
    },
    {
      code: 'f(xs) = count(p, xs) > 0\n',
      errors: [
        {
          messageId: 'issue',
          suggestions: [
            {
              messageId: 'replace',
              data: {
                message: 'Use Base.any(p, xs).',
              },
              output: 'f(xs) = Base.any(p, xs)\n',
            },
          ],
        },
      ],
    },
    {
      code: 'count(p, # retain\n xs) > 0',
      errors: [
        {
          messageId: 'issue',
          suggestions: [],
        },
      ],
    },
    {
      code: 'f(var"!") = count(p,xs) == 0',
      errors: [
        {
          messageId: 'issue',
          suggestions: [],
        },
      ],
    },
  ],
});
