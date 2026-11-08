import { tester, plugin } from '../helpers.js';
const invalid = code => ({ code, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-concat-growth-in-loop', plugin.rules['no-concat-growth-in-loop'], {
  valid: [
    'function f(a,x); a=vcat(a,x); a; end',
    'function f(xs); a=Int[]; for x in xs; append!(a,x); end; a; end',
    'function f(a,xs); for x in xs; a=vcat(a,x); end; a; end',
    'function f(xs); a=Int[]; for x in xs; a=vcat(a,x); a=Int[]; end; end',
    'function f(xs); a=Int[]; for x in xs; a=vcat(a,x); consume(a); end; end',
    'function f(vcat,xs); a=Int[]; for x in xs; a=vcat(a,x); end; end',
    'function f(Int,xs); a=Int[]; for x in xs; a=vcat(a,x); end; end',
    '@m function f(xs); a=Int[]; for x in xs; a=vcat(a,x); end; end',
    'quote function f(xs); a=Int[]; for x in xs; a=vcat(a,x); end; end end',
    'function f(xs); a=Int[]; for x in xs; a=vcat(a,x...); end; end',
    'function f(xs); a=Int[]; for x in xs; a=vcat(a,x; option=true); end; end',
    'function f(xs); a=Int[]; for x in xs; if ready(x); a=vcat(a,x); end; end; end',
    'function f(xs); a=Int[]; for x in xs; a=vcat(a,x); ()->a; end; end',
  ],
  invalid: [
    invalid('function f(xs); a=Int[]; for x in xs; a=vcat(a,x); end; a; end'),
    invalid('function f(xs); α=zeros(2,0); for x in xs; α=hcat(α,x); end; α; end'),
    invalid('function f(); a=[]; for i in 1:100; a=Base.vcat(a,[i]); end; a; end'),
    invalid('function f(n); a=Vector{Int}(); while n>0; a=vcat(a,[n]); n-=1; end; a; end'),
  ],
});
