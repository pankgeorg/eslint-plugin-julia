import { tester, plugin } from '../helpers.js';
const invalid = (code, output) => ({ code, errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }] });
tester.run('no-collect-before-range-iteration', plugin.rules['no-collect-before-range-iteration'], {
  valid: [
    'for i in 1:100; consume(i); end',
    'for k in collect(keys(d)); delete!(d,k); end',
    'for i in collect(1:n); consume(i); end',
    'for i in collect(1:0:100); consume(i); end',
    'for i in collect(1.0:10.0); consume(i); end',
    'f(collect)=begin for i in collect(1:10); i; end end',
    '@m for i in collect(1:10); i; end',
    'quote for i in collect(1:10); i; end end',
    '[i for i in collect(1:10)]',
    'for i in collect(1:100; option=true); i; end',
    'for i in collect(1:999999999999999999999999999999); i; end',
  ],
  invalid: [
    invalid('for i in collect(1:100); consume(i); end', 'for i in 1:100; consume(i); end'),
    invalid('for α = Base.collect(2:2:64); consume(α); end', 'for α = 2:2:64; consume(α); end'),
    invalid('function f(); for i in collect(20:-1:1); i; end; end', 'function f(); for i in 20:-1:1; i; end; end'),
    invalid('for i in collect((1:3)); i; end', 'for i in (1:3); i; end'),
    { code: 'for i in collect(1: # retain\n 3); i; end', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
  ],
});
