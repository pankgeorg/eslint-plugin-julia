import { tester, plugin } from '../helpers.js';
const bad = (code, names, options) => ({
  code,
  ...(options ? { options: [options] } : {}),
  errors: names.map((name) => ({ messageId: 'assign', data: { name } })),
});
tester.run('no-const-reassign', plugin.rules['no-const-reassign'], {
  valid: [
    '@static if flag; const X=1; else const X=2; end',
    'if flag; const X=1; else X=2; end',
    'const ITEMS=[1]; push!(ITEMS,2)',
    'const LIMIT=1; function f(); LIMIT=2; LIMIT; end',
    'const obj=[1]; obj[1]=2',
    'const obj=(x=1,); obj.x=2',
    'x=1; x=2',
    'module A; const x=1; end; module B; x=2; end',
    'quote const x=1; x=2; end',
    '@enum X a; a=2',
    'const 🐱=1; f()=(🐱=2)',
  ],
  invalid: [
    bad('if flag; const X=1; else const X=2; X=3; end', ['X']),
    bad('const LIMIT=1; LIMIT=2', ['LIMIT']),
    bad('const NAME="a"; const NAME="b"', ['NAME']),
    bad('const RATE=1; RATE+=1', ['RATE']),
    bad('const x=1; f()=(global x=2)', ['x']),
    bad('const x=1; f()=(global x+=1)', ['x']),
    bad('f()=(global const x=1); global x=2', ['x']),
    bad('const x,y=1,2; x,y=3,4', ['x', 'y']),
    bad('const 🐱=1; 🐱=2', ['🐱']),
    bad('const var"a b"=1; var"a b"=2', ['a b']),
    bad('x=1', ['x'], { readonlyGlobals: ['x'] }),
    bad('@inline f()=(global x=2); const x=1', ['x']),
  ],
});
