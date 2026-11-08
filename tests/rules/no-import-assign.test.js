import { tester, plugin } from '../helpers.js';
const bad = (code, names, options) => ({
  code,
  ...(options ? { options: [options] } : {}),
  errors: names.map((name) => ({ messageId: 'assign', data: { name } })),
});
tester.run('no-import-assign', plugin.rules['no-import-assign'], {
  valid: [
    '@static if flag; const x=1; else using M: x; end',
    'if a; x=1; elseif b; import M:x; else x=2; end',
    'import Base: show; struct T end; show(io::IO,x::T)=print(io,"T")',
    'import Base: sin; function f(); sin=1; sin; end',
    'using M: obj; obj.field=1; obj[1]=2',
    'using M: xs; push!(xs,1)',
    'module A; import M: x; end; module B; x=1; end',
    'using M; x=1',
    'quote import M: x; x=1; end',
    '@enum Color red; red=1',
  ],
  invalid: [
    bad('import Base: sin; sin=0', ['sin']),
    bad('using Base: cos; cos=1', ['cos']),
    bad('import Base: sqrt as root; root=2', ['root']),
    bad('import M: x; x+=1', ['x']),
    bad('import M:x; f()=(global x+=1)', ['x']),
    bad('import M: x; f()=(global x=1)', ['x']),
    bad('import M: x,y; (x,y)=(1,2)', ['x', 'y']),
    bad('using M; M=1', ['M']),
    bad('import M: 🐱; 🐱=1', ['🐱']),
    bad('using M; x=1', ['x'], { moduleExports: { M: ['x'] } }),
    bad('@inline f()=(global x=1); import M: x', ['x']),
  ],
});
