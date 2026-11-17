import { tester, plugin } from '../helpers.js';
const bad = (code) => ({ code, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-self-identity-comparison', plugin.rules['no-self-identity-comparison'], {
  valid: [
    'f(x)=x!=x',
    'f(x)=x==x',
    'f(x,y)=x===y',
    'nextvalue()===nextvalue()',
    'x=1; x===x',
    'f(x)=x.a===x.a',
    'f(x)=x .=== x',
    'function f(x); g()=x; x===x; end',
    'function f(x); @async x=2; x===x; end',
    'f(var"===",x)=x===x',
    '@foo f(x)=x===x',
    'quote f(x)=x===x end',
  ],
  invalid: [bad('f(x)=x===x'), bad('f(x)=x!==x'), bad('let x=1; x===x; end'), bad('f(α)=(α)===α')],
});
