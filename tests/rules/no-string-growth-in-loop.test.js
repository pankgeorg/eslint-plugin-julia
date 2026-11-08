import { tester, plugin } from '../helpers.js';
const invalid = (code) => ({ code, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-string-growth-in-loop', plugin.rules['no-string-growth-in-loop'], {
  valid: [
    'function f(xs); p=1; for x in xs; p*=x; end; p; end',
    'function f(s,xs); for x in xs; s*=x; end; s; end',
    'function f(xs); s=""; for x in xs; s*=x; consume(s); end; s; end',
    'function f(xs); s=""; for x in xs; if x>0; s*="x"; end; end; s; end',
    'function f(xs); s=""; for x in xs; s*="x"; s=""; end; s; end',
    'function f(xs); s=""; for x in xs; s*="x"; ()->s; end; end',
    'function f(xs); s=""; g=()->s; for x in xs; s*="x"; end; end',
    'function f(xs); s="$(seed)"; for x in xs; s*="x"; end; end',
    '@m function f(xs); s=""; for x in xs; s*="x"; end; end',
    'quote function f(xs); s=""; for x in xs; s*="x"; end; end end',
    'function f(xs, (*)); s=""; for x in xs; s=s*x; end; end',
    'function f(xs); s=""; for x in xs; s=s*string(s); end; end',
    's=""; for x in xs; global s; s*="x"; end',
  ],
  invalid: [
    invalid('function f(); s=""; for i in 1:100; s*="x"; end; s; end'),
    invalid('function f(xs); α="λ:"; for x in xs; α=α*string(x); end; α; end'),
    invalid('function f(n); s=""; while n>0; s=s*"ab"; n-=1; end; s; end'),
    invalid('function f(xs); s=""; for x in xs; s=(s)*"x"; end; s; end'),
  ],
});
