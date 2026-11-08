import { tester, plugin } from '../helpers.js';
tester.run('no-full-slice-in-consumer', plugin.rules['no-full-slice-in-consumer'], {
  valid: [
    'f(a)=length(a[:])',
    'function f(); a=[1,2]; saved=a[:]; saved; end',
    'function f(); a=[1,2]; a[:].=0; a; end',
    'function f(length); a=[1,2]; length(a[:]); end',
    'function f(Int); a=Int[1,2]; length(a[:]); end',
    'function f(); a=[1,2]; a=custom(); length(a[:]); end',
    'function f(); a=[1,2]; @views sum(a[:]); end',
    'quote function f(); a=[1,2]; length(a[:]); end end',
    'function f(); a=[1,2]; length(a[1:2]); end',
  ],
  invalid: [
    { code: 'function f(); a=[1,2]; for x=a[:]; consume(x); end; end', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
    { code: 'function f(); a=[1,2,3]; length(a[:]); end', errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output: 'function f(); a=[1,2,3]; length(a); end' }] }] },
    { code: 'function f(); α=[1 2;3 4]; sum(α[:]); end', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
    { code: 'function f(); a=Int[1,2]; for x in a[:]; consume(x); end; end', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
    { code: 'let α=[1,2]; Base.length((α[:])); end', errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output: 'let α=[1,2]; Base.length((α)); end' }] }] },
  ],
});
