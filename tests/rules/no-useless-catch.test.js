import { tester, plugin } from '../helpers.js';
const bad = (code) => ({ code, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-useless-catch', plugin.rules['no-useless-catch'], {
  valid: [
    'try work() catch; rethrow{Int}(); end',
    'try work() catch e; log(e); rethrow(); end',
    'try work() catch e; rethrow(e); end',
    'try work() catch; # breakpoint\n rethrow(); end',
    'try work() catch; rethrow(); finally cleanup(); end',
    'try work() catch; rethrow(); else success(); end',
    'f(rethrow)=try work() catch; rethrow(); end',
    '@foo try work() catch; rethrow(); end',
    'quote try work() catch; rethrow(); end end',
  ],
  invalid: [
    bad('try work() catch; rethrow(); end'),
    bad('try work() catch err; rethrow(); end'),
    bad('function f(); try return work() catch σ; Base.rethrow(); end; end'),
    {
      ...bad('try work() catch; # breakpoint\n rethrow(); end'),
      options: [{ allowComment: false }],
    },
  ],
});
