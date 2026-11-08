import { tester, plugin } from '../helpers.js';
const bad = (code, output) => ({ code, errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }] });
tester.run('no-useless-assignment', plugin.rules['no-useless-assignment'], {
  valid: ['function f(); for i in 1:1; @make_task(); end; x=0; x=1; x; end', 'function f(); x=0; consume(x); x=1; x; end',
    'function f(); x=initialize(); x=1; x; end', 'function f(); x=0; x=x+1; x; end',
    'x=0; x=1; x', 'function f(); x::Int=0; x=1; x; end',
    'function f(); x=0; g()=x; x=1; x; end',
    'function f(); x=0; x=1; @async println(x); x; end',
    'function f(); if ready; x=0; x=1; x; end; end',
    '@foo function f(); x=0; x=1; x; end', 'quote function f(); x=0; x=1; x; end end',
    'function f(); x=2147483648; x=1; x; end'],
  invalid: [bad('function f(); x=0; x=1; return x; end', 'function f(); ; x=1; return x; end'),
    bad('function f(); ready=false; ready=true; consume(ready); end', 'function f(); ; ready=true; consume(ready); end'),
    bad('function f(); α=1; α=2; return α+1; end', 'function f(); ; α=2; return α+1; end'),
    { code: 'function f(); x=0 # initialize\n x=1; x; end', errors: [{ messageId: 'diagnostic', suggestions: [] }] }],
});
