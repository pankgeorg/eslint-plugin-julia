import { tester, plugin } from '../helpers.js';
const bad = code => ({ code, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-catch-binding-reassign', plugin.rules['no-catch-binding-reassign'], {
  valid: ['try work() catch e; wrapped=wrap(e); throw(wrapped); end',
    'try work() catch e; let e=replacement(); log(e); end; end',
    'try work() catch e; e.context="request"; end',
    'try work() catch e; f(e)=(e=1); end',
    '@foo try work() catch e; e=nothing; end', 'quote try work() catch e; e=nothing; end end'],
  invalid: [bad('try work() catch e; e=nothing; log(e); end'),
    bad('try work() catch e; e=wrap(e); throw(e); end'),
    bad('try work() catch α; α+=1; consume(α); end'),
    bad('try work() catch e; f()=(e=nothing); f(); end'),
    bad('try work() catch e; (e,x)=(nothing,1); end')],
});
