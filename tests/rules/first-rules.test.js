import { tester, plugin } from '../helpers.js';
const run = (name, cases) => tester.run(name, plugin.rules[name.replace(' explicit fix', '')], cases);
const duplicate = (name, extra = {}) => ({ messageId: 'duplicate', data: { name }, ...extra });
run('no-duplicate-struct-fields', {
  valid: ['struct S; x; y::Int; end', 'mutable struct S; const x::Int; y; end',
    'struct S; x; S(x)=new(x); end', 'struct S; x; function f(); x=1; end; end',
    '@m struct S; x; x; end', 'quote struct S; x; x; end end',
    'struct S; @field x; @field x; end', 'struct S; x=1; x=2; end', 'x = (a=1,a=2)',
    'struct S; var"x"; x; end', 'struct S; x; begin x end; end'],
  invalid: [
    { code: 'struct S; x; x; end', errors: [duplicate('x')], output: null },
    { code: 'struct S; x::Int; x::Float64; end', errors: [duplicate('x')], output: null },
    { code: 'mutable struct S; const x::Int; x; end', errors: [duplicate('x')], output: null },
    { code: 'struct 🐱; α; α::Int; end', errors: [duplicate('α', { column: 15 })], output: null },
    { code: 'struct S; x; x; x; end', errors: [duplicate('x'), duplicate('x')], output: null },
  ],
});
run('no-duplicate-keyword-arguments', {
  valid: ['f(; a=1, b=2)', 'f(a=1,b=2)', 'f(x,x)', '(a=1,a=2)', 'f(;a,a)',
    'f(; a=1,kw...,a=2)', 'f(xs...,a=1,a=2)', 'f(;obj.a=1,obj.a=2)',
    'f(a=1,a=2)=a', 'function f(;a=1,a=2); end',
    'function f(a::T=1,a::T=2) where T; end', '@m f(a=1,a=2)', ':(f(a=1,a=2))',
    'f(a=(b=1), c=(b=2))', 'f((a=1),(a=2))', 'f.(a=1,a=2)'],
  invalid: [
    { code: 'f(a=1,a=2)', errors: [duplicate('a')], output: null },
    { code: 'f(;a=1,a=2)', errors: [duplicate('a')], output: null },
    { code: 'f(a=1;a=2)', errors: [duplicate('a')], output: null },
    { code: '🐱(α=1;α=2)', errors: [duplicate('α', { column: 8 })], output: null },
    { code: 'f(;a=1,a=2,a=3)', errors: [duplicate('a'), duplicate('a')], output: null },
    { code: 'function g(); f(a=1,a=2); end', errors: [duplicate('a')], output: null },
  ],
});
run('no-empty-catch', {
  valid: ['try f(); catch err; rethrow(); end', 'try f(); finally; end',
    { code: 'try f(); catch; # deliberately ignored\nend', options: [{ allowComment: true }] },
    { code: 'try f(); catch e; #= deliberate =#\nend', options: [{ allowComment: true }] },
    '@m try f(); catch; end', 'quote try f(); catch; end end',
    'try f(); catch; nothing; end'],
  invalid: [
    { code: 'try f(); catch; end', errors: [{ messageId: 'empty' }], output: null },
    { code: 'try f(); catch err; end', errors: [{ messageId: 'empty' }], output: null },
    { code: 'try f(); catch; # intentional\nend', errors: [{ messageId: 'empty' }], output: null },
    { code: 'try 🐱(); catch; end', errors: [{ messageId: 'empty', column: 11 }], output: null },
    { code: 'try # hi\nf(); catch; end', options: [{ allowComment: true }], errors: [{ messageId: 'empty' }], output: null },
    { code: 'try f(); catch; finally # no\nf(); end', options: [{ allowComment: true }], errors: [{ messageId: 'empty' }], output: null },
  ],
});
const shadow = (name = 'i', extra = {}) => ({ messageId: 'shadow', data: { name }, ...extra });
run('no-shadowed-loop-var', {
  valid: ['for i in xs; for j in ys; end; end', 'for i in xs; end; for i in ys; end',
    'for i in xs; for outer i in ys; end; end', 'for outer i in xs; for i in ys; end; end',
    'for i in xs; f(i); end', 'for i in (i for i in xs); end',
    'for i in xs, i in ys; end', '[i for i in xs, i in ys]',
    'for i in xs; function f(); for i in ys; end; end; end',
    'for i in xs; let i=0; for i in ys; end; end; end',
    'for i in xs; @m for i in ys; end; end', 'quote for i in xs; for i in ys; end; end end',
    'for _ in xs; for _ in ys; end; end', '[i for i in (i for i in xs)]'],
  invalid: [
    { code: 'for i in xs; for i in ys; end; end', errors: [shadow()], output: null },
    { code: 'for (i,x) in xs; for x in ys; end; end', errors: [shadow('x')], output: null },
    { code: 'for (i,(x,y)) in xs; for y in ys; end; end', errors: [shadow('y')], output: null },
    { code: 'for 🐱 in xs; for 🐱 in ys; end; end', errors: [shadow('🐱', { column: 19 })], output: null },
    { code: 'for i in xs; [i for i in ys]; end', errors: [shadow()], output: null },
    { code: '[i for i in xs for i in ys]', errors: [shadow()], output: null },
    { code: '(i for i in xs for i in ys)', errors: [shadow()], output: null },
    { code: '[i for i in xs if any(i for i in ys)]', errors: [shadow()], output: null },
    { code: '[i for i in xs if i>0 for i in ys]', errors: [shadow()], output: null },
    { code: '[(i for i in ys) for i in xs]', errors: [shadow()], output: null },
    { code: 'for i in xs; for j in ys; for i in zs; end; end; end', errors: [shadow()], output: null },
  ],
});
run('prefer-identity-nothing explicit fix', {
  valid: ['x === nothing'],
  invalid: [
    { code: 'x == nothing', options: [{ fix: true }], output: 'x === nothing', errors: [{ messageId: 'identity',
      suggestions: [{ messageId: 'replace', data: { replacement: '===' }, output: 'x === nothing' }] }] },
    { code: 'x == nothing\n)', languageOptions: { recover: true }, options: [{ fix: true }], output: null,
      errors: [{ messageId: 'identity', suggestions: [] }] },
  ],
});
