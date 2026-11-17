import { tester, plugin } from '../helpers.js';
const bad = (code, names) => ({
  code,
  errors: names.map((name) => ({ messageId: 'duplicate', data: { name } })),
});
tester.run('no-dupe-args', plugin.rules['no-dupe-args'], {
  valid: [
    'f(x,y)=x+y',
    'f(_,_)=1',
    'f(_,__)=1',
    'f(::Int,::Int)=1',
    'f(x)=x; f(x,y)=y',
    'f(x)=g(x;x=x); g(z;x)=x',
    'f(x)=x->x',
    'f((x,y); z=1)=x',
    '@m x x',
    'quote f(x,x)=x; end',
    'f(var"a b",var"c d")=1',
    'f(x::T) where T=x',
    'f(x...)=x',
  ],
  invalid: [
    bad('function f(x,x); x; end', ['x']),
    bad('f(x;x=1)=x', ['x']),
    bad('g=(x,x)->x', ['x']),
    bad('f(xs) do x,x; x; end', ['x']),
    bad('f((x,(y,x)))=x', ['x']),
    bad('f(x::Int,x::Float64)=x', ['x']),
    bad('f(x=1,x=2)=x', ['x']),
    bad('f(x;x...)=x', ['x']),
    bad('f(🐱,🐱)=🐱', ['🐱']),
    bad('f(var"a b",var"a b")=1', ['a b']),
    bad('@inline f(x,x)=x', ['x']),
    bad('macro m(x,x); x; end', ['x']),
    bad('f(@nospecialize(x),x)=x', ['x']),
  ],
});
