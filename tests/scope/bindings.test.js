import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJulia } from '../../src/parser/syntax-tree.js';
import { JuliaSourceCode } from '../../src/source-code.js';
import { getScopeManager, resolve, isReadReference, isUnshadowedBuiltin } from '../../src/scope.js';
function analyze(code) {
  const parsed = parseJulia(code); assert.deepEqual(parsed.diagnostics.filter(d => d.level === 1), []);
  const source = new JuliaSourceCode(code, parsed); return [getScopeManager(source), source];
}
const cases = [
  ['gensym binding', '@gensym a b; a; b', 'a', 'assignment'],
  ['qualified gensym binding', 'Base.@gensym α; α', 'α', 'assignment'],
  ['gensym local', 'f()=(@gensym x; x)', 'x', 'assignment'],
  ['Pluto bind', '@bind x 1; x', 'x', 'assignment'],
  ['qualified Pluto bind', 'PlutoUI.@bind α 1; α', 'α', 'assignment'],
  ['Pluto quoted name', '@bind var"a b" 1; var"a b"', 'a b', 'assignment'],
  ['empty generic declaration', 'function f end; f', 'f', 'function'],
  ['Unicode empty generic declaration', 'function α end; α', 'α', 'function'],
  ['alias parameter', 'const A{T}=Vector{T}', 'T', 'type-parameter'],
  ['double bound parameter', 'f(x::T) where {Int<:T<:Number}=x', 'T', 'type-parameter'],
  ['macro implicit argument', 'macro m(); __module__; end', '__module__', 'implicit-argument'],
  ['nospecialize argument', 'f(@nospecialize x)=x', 'x', 'argument'],
  ['ccall syntax intrinsic', 'ccall(:f,Int,())', 'ccall', 'builtin'],
  ['later local', 'f()=(x; x=1)', 'x', 'assignment'],
  ['argument', 'f(x)=x', 'x', 'argument'],
  ['keyword', 'f(;x=1)=x', 'x', 'keyword'],
  ['keyword splat', 'f(;kw...)=kw', 'kw', 'keyword'],
  ['destructured argument', 'f((x,y))=x', 'x', 'argument'],
  ['typed argument', 'f(x::T)=x', 'x', 'argument'],
  ['vararg', 'f(x...)=x', 'x', 'argument'],
  ['anonymous function', 'g=x->x', 'x', 'argument'],
  ['do argument', 'map(xs) do x; x; end', 'x', 'argument'],
  ['let binding', 'let x=1; x; end', 'x', 'let'],
  ['loop binding', 'for x in xs; x; end', 'x', 'iteration'],
  ['loop destructuring', 'for (x,y) in xs; x; end', 'x', 'iteration'],
  ['comprehension', '[x for x in xs]', 'x', 'iteration'],
  ['generator', '(x for x in xs)', 'x', 'iteration'],
  ['filtered generator', '[x for x in xs if x>0]', 'x', 'iteration'],
  ['catch variable', 'try a(); catch e; e; end', 'e', 'catch'],
  ['while local', 'while true; x=1; x; end', 'x', 'assignment'],
  ['try local', 'try x=1; x; catch; end', 'x', 'assignment'],
  ['local declaration', 'f()=(local x; x)', 'x', 'declaration'],
  ['global declaration', 'f()=(global x; x)', 'x', 'declaration'],
  ['const declaration', 'const x=1; x', 'x', 'assignment'],
  ['typed assignment', 'x::Int=1; x', 'x', 'assignment'],
  ['destructuring', '(x,(y,z))=v; z', 'z', 'assignment'],
  ['property destructuring', '(;x,y)=v; y', 'y', 'assignment'],
  ['explicit import', 'import M: x; x', 'x', 'import'],
  ['explicit using', 'using M: x; x', 'x', 'import'],
  ['import alias', 'import M: x as y; y', 'y', 'import'],
  ['module import', 'import M; M', 'M', 'import'],
  ['module using', 'using M; M', 'M', 'import'],
  ['dotted module using', 'using M.N; N', 'N', 'import'],
  ['function name', 'f()=1; f()', 'f', 'function'],
  ['struct name', 'struct X end; X', 'X', 'type'],
  ['abstract name', 'abstract type X end; X', 'X', 'type'],
  ['primitive name', 'primitive type X 8 end; X', 'X', 'type'],
  ['module name', 'module M end; M', 'M', 'module'],
  ['where type', 'f(x::T) where T=x', 'T', 'type-parameter'],
  ['struct type parameter', 'struct X{T}; x::T; end', 'T', 'type-parameter'],
  ['where expression', 'Vector{T} where T', 'T', 'type-parameter'],
  ['Unicode', 'f(🐱)=🐱', '🐱', 'argument'],
  ['quoted identifier', 'var"hello world"=1; var"hello world"', 'hello world', 'assignment'],
  ['builtin', 'sin(1)', 'sin', 'builtin'],
  ['Core in baremodule', 'baremodule M; Int; end', 'Int', 'builtin'],
  ['Base absent in baremodule', 'baremodule M; sin; end', 'sin', null],
  ['macro generates nothing', '@enum X a b; a', 'a', null],
  ['macro written assignment', '@views x=a[:]; x', 'x', 'assignment'],
  ['decorated definition', '@inline f(x)=x; f(1)', 'f', 'function'],
  ['new intrinsic', 'struct X; x; X(x)=new(x); end', 'new', 'intrinsic'],
];
for (const [name, code, target, kind] of cases) test(`scope: ${name}`, () => {
  const [m] = analyze(code), refs = m.references.filter(r => r.name === target);
  assert.ok(refs.length, target); assert.equal(refs.at(-1).binding?.kind ?? null, kind);
  assert.equal(resolve(refs.at(-1).node), refs.at(-1).binding); assert.ok(isReadReference(refs.at(-1).node));
});
test('scope: cache and builtin helper respect later shadowing', () => {
  const [m,s] = analyze('sin(1); f()=(sin(2); sin=x); Base.sin(3)');
  assert.equal(getScopeManager(s), m);
  const refs=m.references.filter(r=>r.name==='sin');
  assert.ok(isUnshadowedBuiltin(refs[0].node,'sin')); assert.ok(!isUnshadowedBuiltin(refs[1].node,'sin'));
  const dot=s.ast.children[0].children.at(-1)?.children?.[0];
  const dots=[]; const walk=n=>{if(n.kind==='.')dots.push(n);n.children.forEach(walk);}; walk(s.ast);
  assert.ok(isUnshadowedBuiltin(dots[0],'sin'));
});
test('scope: assignments capture a later enclosing local across hard and soft scopes', () => {
  const [m]=analyze('f()=(g()=(x=2); for i in xs; x=3; end; x=1; x)');
  const ds=m.definitions.filter(d=>d.name==='x'); assert.equal(new Set(ds.map(d=>d.binding)).size,1);
});
test('scope: file soft scope never updates a global implicitly', () => {
  const [m]=analyze('x=1; for i in xs; x=2; end; x');
  const ds=m.definitions.filter(d=>d.name==='x'); assert.notEqual(ds[0].binding,ds[1].binding);
});
test('scope: local forces shadow and global forces module write', () => {
  const [m]=analyze('x=0; f(x)=(let; local x=2; x; end; g()=(global x=3))');
  const ds=m.definitions.filter(d=>d.name==='x');
  assert.equal(new Set(ds.map(d=>d.binding)).size,3); assert.equal(ds[0].binding,ds.at(-1).binding);
});
test('scope: let initializers and iteration ranges use prior scopes', () => {
  const [m]=analyze('x=0; let x=x,y=x; y; end; for x in x, y in x; y; end');
  const refs=m.references.filter(r=>r.name==='x'); assert.equal(refs[0].binding.scope.kind,'module');
  assert.equal(refs[1].binding.kind,'let'); assert.equal(refs[2].binding.scope.kind,'module');
  assert.equal(refs[3].binding.kind,'iteration');
});
test('scope: defaults see earlier arguments, not later arguments or body locals', () => {
  const [m]=analyze('x=1; f(a=x,x=2,b=a,c=y)=(y=1; b)');
  const rs=m.references;
  assert.equal(rs.find(r=>r.name==='x').binding.scope.kind,'module');
  assert.equal(rs.find(r=>r.name==='a').binding.kind,'argument');
  assert.equal(rs.find(r=>r.name==='y').binding,null);
});
test('scope: modules isolate parent bindings and keep their own name', () => {
  const [m]=analyze('x=1; module M; x; M; end');
  assert.equal(m.references.find(r=>r.name==='x').binding,null);
  assert.equal(m.references.find(r=>r.name==='M').binding.kind,'module-self');
});
test('scope: labels and fields are not reads', () => {
  const [m]=analyze('a.b; f(k=x); (;k=x); struct X; field::Int; end; @m x');
  for(const name of ['b','k','field','m']) assert.ok(!m.references.some(r=>r.name===name));
});
test('scope: quote depth and executable interpolation', () => {
  const [m]=analyze('quote a; $b; quote $c; $$d; end; end');
  assert.deepEqual(m.references.map(r=>r.name),['b','d']);
});
test('scope: macro arguments count written reads, but never synthesized bindings', () => {
  const [m]=analyze('f(x)=(@show x; @enum X a b; a)');
  assert.ok(m.references.find(r=>r.name==='x').binding); assert.equal(m.references.at(-1).binding,null);
  assert.ok(!m.definitions.some(d=>d.name==='a'));
});
test('scope: outer iteration reuses enclosing local', () => {
  const [m]=analyze('f()=(i=0; for outer i in xs; i; end)');
  assert.equal(new Set(m.definitions.filter(d=>d.name==='i').map(d=>d.binding)).size,1);
});

test('scope: index begin and end are syntax, not names', () => {
  const [m]=analyze('A[begin:end]'); assert.deepEqual(m.references.map(r=>r.name),['A', ':']);
});

test('scope: logging and test macro metadata labels never bind locals', () => {
  const [m]=analyze('f(x)=(@error "oops" exception=x; @test x≈1 atol=0.1)');
  assert.ok(!m.definitions.some(d=>["exception","atol"].includes(d.name)));
});

test('scope: arbitrary macro DSL keyword operands are not bindings', () => {
  const [m]=analyze('@cuda blocks=1 f(x); @parameters p=1; p; blocks');
  assert.ok(!m.definitions.some(d=>['blocks','p'].includes(d.name)));
  assert.equal(m.references.at(-1).binding,null);
});

test('scope: indexing keyword labels are not assignments or reads', () => {
  const [m]=analyze('f(x,i)=x[dim=i]');
  assert.ok(!m.definitions.some(d=>d.name==='dim'));
  assert.ok(!m.references.some(r=>r.name==='dim'));
  assert.ok(m.references.some(r=>r.name==='i' && r.binding));
});

test('scope: explicit global compound writes resolve the module binding', () => {
  const [m]=analyze('x=1; f()=(global x+=1)');
  const ds=m.definitions.filter(d=>d.name==='x');
  assert.equal(ds[0].binding,ds[1].binding);
  assert.equal(m.references.find(r=>r.name==='x').binding,ds[0].binding);
});
test('scope: qualified dynamic calls mark containing scopes', () => {
  const [m]=analyze('f()=Base.eval(Main,:x)');
  assert.ok(m.functions[0].scope.dynamic);
});

test('scope: empty generic function declarations bind their name', () => {
  const [m]=analyze('function f end; f');
  assert.equal(m.references[0].binding.kind,'function');
});
test('scope: baremodule can explicitly use Base exports', () => {
  const [m]=analyze('baremodule M; using Base; sin(1); end');
  // with module resolution, `using Base` binds Base's exports as imports from Base
  assert.ok(['builtin', 'import'].includes(m.references.find(r=>r.name==='sin').binding.kind));
});
test('scope: dynamic module names create no fabricated binding', () => {
  const [m]=analyze('@eval module $name; end');
  assert.ok(m.definitions.every(d=>d.name!==null));
  assert.ok(m.references.some(r=>r.name==='name'));
});
test('scope: builtin helpers accept var wrappers', () => {
  const [m,s]=analyze('var"sin"(1)');
  const call=s.ast.children[0].children[0];
  assert.ok(m.isUnshadowedBuiltin(call.children[0],'sin'));
});

test('scope: explicit Base imports and namespace aliases preserve builtin identity', () => {
  const [m,s]=analyze('using Base: sin; import Base as B; sin(1); B.sin(1)');
  const calls=[]; const walk=n=>{if(n.kind==='call')calls.push(n);n.children.forEach(walk);};walk(s.ast);
  assert.ok(m.isUnshadowedBuiltin(calls[0].children[0],'sin'));
  assert.ok(m.isUnshadowedBuiltin(calls[1].children[0],'sin'));
});
test('scope: assigning an imported builtin defeats builtin trust', () => {
  const [m]=analyze('using Base: sin; sin=1; sin');
  assert.ok(!m.isUnshadowedBuiltin(m.references.at(-1).node,'sin'));
});

test('scope: recovered parse errors leave an empty conservative manager', () => {
  const code='struct end'; const parsed=parseJulia(code);
  assert.ok(parsed.diagnostics.some(d=>d.level===1));
  const m=getScopeManager(new JuliaSourceCode(code,parsed));
  assert.equal(m.definitions.length,0); assert.equal(m.references.length,0);
});

test('scope: standard expression macros retain written assignments', () => {
  const [m]=analyze('f()=(@show x=1; @assert y=true; x+y)');
  assert.ok(m.references.filter(r=>['x','y'].includes(r.name)).every(r=>r.binding));
});
test('scope: first test expression can assign, while test metadata cannot bind', () => {
  const [m]=analyze('f()=(@test x=true atol=0.1; x)');
  assert.ok(m.references.find(r=>r.name==='x').binding);
  assert.ok(!m.definitions.some(d=>d.name==='atol'));
});

test('scope: explicit global declarations propagate through nested loops and closures', () => {
  const [m]=analyze('x=0; f()=(global x; for i in xs; x=1; end; g()=(x=2); g())');
  const ds=m.definitions.filter(d=>d.name==='x');
  assert.equal(new Set(ds.map(d=>d.binding)).size,1);
  assert.equal(ds[0].binding.scope.kind,'module');
});
test('scope: a forced inner local overrides an inherited global declaration', () => {
  const [m]=analyze('x=0; f()=(global x; let x=1; x; end)');
  const ds=m.definitions.filter(d=>d.name==='x');
  assert.notEqual(ds[0].binding,ds.at(-1).binding);
});

test('scope: qualified macro namespaces resolve in the module rather than runtime locals', () => {
  const [m]=analyze('module M end; f(M,x)=(M.@m x; M.r"text")');
  assert.equal(m.references.filter(r=>r.name==='M').length,2);
  assert.ok(m.references.filter(r=>r.name==='M').every(r=>r.binding?.kind==='module'));
  assert.ok(!m.references.some(r=>r.name==='m'));
});
test('scope: quoted macro declaration names match written var exports', () => {
  const [m]=analyze('macro var"odd macro"(x);x;end; export var"@odd macro"');
  assert.ok(m.lookup(m.exports[0].name));
});

test('scope: argument types use static bindings rather than value arguments', () => {
  const [m]=analyze('T=Int; f(T,x::T)=T');
  const refs=m.references.filter(r=>r.name==='T');
  assert.equal(refs[0].binding.scope.kind,'module');
  assert.equal(refs[1].binding.kind,'argument');
});
test('scope: a value argument cannot supply an undeclared signature type', () => {
  const [m]=analyze('f(T,x::T)=x');
  assert.equal(m.references.find(r=>r.name==='T').binding,null);
});
test('scope: keyword types are static, while defaults see earlier value arguments', () => {
  const [m]=analyze('T=Int; f(T;x::T=one(T))=x');
  const refs=m.references.filter(r=>r.name==='T').sort((a,b)=>a.node.range[0]-b.node.range[0]);
  assert.equal(refs[0].binding.scope.kind,'module');
  assert.equal(refs[1].binding.kind,'argument');
});
test('scope: default-expression locals do not become method-body locals', () => {
  const [m]=analyze('f(x=(y=1))=y');
  assert.equal(m.references.find(r=>r.name==='y').binding,null);
  assert.equal(m.definitions.find(d=>d.name==='y').scope.kind,'default');
});
test('scope: default callbacks do not capture later body-local assignments', () => {
  const [m]=analyze('f(g=()->(y=1;y))=(y=2;g)');
  assert.equal(new Set(m.definitions.filter(d=>d.name==='y').map(d=>d.binding)).size,2);
});
test('scope: static method-type expression assignments affect the outer environment', () => {
  const [m]=analyze('f(x::(Y=Int)) where T=x; Y');
  assert.equal(m.references.at(-1).binding.scope.kind,'module');
});
test('scope: struct type expressions have a local type-building environment', () => {
  const [m]=analyze('Z=Float64; struct S; x::(Z=Int); end; Z');
  assert.equal(new Set(m.definitions.filter(d=>d.name==='Z').map(d=>d.binding)).size,2);
  assert.equal(m.references.at(-1).binding.scope.kind,'module');
});
test('scope: inner constructor names and recursive field types refer to the declared type', () => {
  const [m]=analyze('struct S; x::S; S(x::S)=new(x); end');
  const type=m.lookup('S');
  assert.ok(m.definitions.filter(d=>d.name==='S').every(d=>d.binding===type));
  assert.ok(m.references.filter(r=>r.name==='S').every(r=>r.binding===type));
});
test('scope: constructor body assignment can shadow its global type name', () => {
  const [m]=analyze('struct S; S()=(S=1;new()); end');
  assert.notEqual(m.definitions.find(d=>d.name==='S' && d.initialized).binding,m.lookup('S'));
});
test('scope: where bounds cannot read later method-body locals', () => {
  const [m]=analyze('f(x::T) where T<:S=(S=Real;x)');
  assert.equal(m.references.find(r=>r.name==='S').binding,null);
});
test('scope: macro defaults can read language-supplied arguments', () => {
  const [m]=analyze('macro m(x=__module__);x;end');
  assert.equal(m.references.find(r=>r.name==='__module__').binding.kind,'implicit-argument');
});

test('scope: isdefined macro probes are not value reads', () => {
  const [m] = analyze('@isdefined(x); f() = @isdefined(y)');
  assert.ok(!m.references.some(r => ['x', 'y'].includes(r.name)));
});


test('gensym assigns all operands without reading them and captures outer locals', () => {
  const [m] = analyze('f()=(x=1; g()=(@gensym x y; (x,y)); g())');
  const x = m.functions[0].scope.bindings.get('x');
  const y = m.functions[1].scope.bindings.get('y');
  assert.equal(x.definitions.length, 2);
  assert.equal(y.definitions.length, 1);
  assert.equal(y.definitions[0].initialized, true);
  assert.equal(y.definitions[0].assignment.kind, 'macrocall');
  assert.equal(x.references.length, 1);
  assert.equal(y.references.length, 1);
});
test('gensym bindings stay within modules, functions and quote interpolation depth', () => {
  const [m] = analyze('module A; @gensym x; end; x; f()=(@gensym y; y); y; :(@gensym z); z');
  assert.deepEqual(m.references.filter(r => !r.binding && !r.opaque).map(r => r.name), ['x', 'y', 'z']);
});

test('Pluto bind writes a module global and reads its widget in the caller scope', () => {
  const [m] = analyze('f(widget)=(@bind x widget; x); x');
  const x = m.globalScope.bindings.get('x');
  assert.equal(x.definitions.length, 1);
  assert.equal(x.definitions[0].initialized, true);
  assert.equal(x.definitions[0].assignment.kind, 'macrocall');
  assert.equal(x.references.length, 2);
  const widget = m.functions[0].scope.bindings.get('widget');
  assert.equal(widget.references.length, 1);
  assert.equal(widget.references[0].read, true);
});
test('Pluto bind respects module and quoted-code boundaries', () => {
  const [m] = analyze('module A; @bind x 1; x; end; x; :(@bind y 1); y');
  assert.deepEqual(m.references.filter(r => !r.binding && !r.opaque).map(r => r.name), ['x', 'y']);
});
