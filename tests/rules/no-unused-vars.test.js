import { tester, plugin } from '../helpers.js';
const bad=(code,names,options)=>({code,...(options?{options:[options]}:{}),errors:names.map(name=>({messageId:'unused',data:{name}}))});
tester.run('no-unused-vars',plugin.rules['no-unused-vars'],{
 valid:['f(x, spare)=x','f(x,_spare)=x','f(x)=(y=x+1; ()->y)',
 'function f(x); g()=x; g; end', 'x=1', 'struct X; field::Int; end',
 'f(x) where T=x', 'f(x)=@show x', 'f()=(@enum X a b; a)',
 'f(x)=(y=1; y+=1; y)', 'f(x)=(y=1; @custom y)',
 'f()=(var"🐱 name"=1; var"🐱 name")', 'f(x)=x.key',
 {code:'try work(); catch e; nothing; end',options:[{caughtErrors:'none'}]},
 {code:'f(;kw=1)=1',options:[{args:'all',ignoreKeywords:true}]},
 {code:'f()=(x=1; eval(:x))',options:[{dynamicReads:'ignore-containing-scope'}]},
 {code:'f()=(intentional=1; nothing)',options:[{ignorePattern:'^intentional$'}]},
 ],invalid:[
 bad('function f(x); temporary=1; x; end',['temporary']),
 bad('function f(x, spare); x; end',['spare'],{args:'all'}),
 bad('let spare=1; println("ok"); end',['spare']),
 bad('function f(x); scratch=x+1; x; end',['scratch']),
 bad('f(x,extra)=x',['extra'],{args:'all'}),
 bad('function f(xs); for (i,x) in pairs(xs); println(x); end; end',['i']),
 bad('f()=(x=1; x=2; nothing)',['x']), bad('f()=(🐱=1; nothing)',['🐱']),
 bad('f(x)=(y=1; x.y)',['y']), bad('f(x)=(y=1; (;y=x))',['y']),
 bad('f(x)=(y=1; :y)',['y']), bad('f(;kw=1)=1',['kw'],{args:'all'}),
 bad('try work(); catch e; nothing; end',['e']), bad('f()=(x=1; eval(:x))',['x']),
 ]
});

tester.run('no-unused-vars imports',plugin.rules['no-unused-vars'],{
 valid:[
  'using LinearAlgebra: norm; @eval $(Symbol("generated"))()=1',
  'f()=(@parameters x [description="a", misc="final"])',
  'f()=(@variables (x(t)::Real), [input=true])',
  'f()=(@test true atol=1)', 'f()=(@error "message" exception=1)',
  'import Base: show; show(x::Int)=nothing',
  'using Test: @test; @test true', 'import Test as T; T.@test true',
  'using LinearAlgebra; norm([1,2])', 'import LinearAlgebra as LA; LA.norm([1])',
  'using LinearAlgebra: norm; norm([1])', 'using LinearAlgebra: norm; export norm',
  'using LinearAlgebra: norm; @show norm', 'using UnknownModule; possibly_exported()',
  'using LinearAlgebra: norm; include(dynamic_path)',
  'using LinearAlgebra: norm; eval(:(generated_use=norm))',
  'import LinearAlgebra: norm as _norm',
  {code:'using LinearAlgebra: norm',options:[{imports:'none'}]},
 ],invalid:[
  {code:'f()=(@views tmp=1)',errors:[{messageId:'unused',data:{name:'tmp'}}]},
  {code:'using LinearAlgebra: norm',errors:[{messageId:'unusedImport',data:{name:'norm'}}]},
  {code:'using LinearAlgebra',errors:[{messageId:'unusedImport',data:{name:'LinearAlgebra'}}]},
  {code:'import LinearAlgebra: norm as α',errors:[{messageId:'unusedImport',data:{name:'α'}}]},
  {code:'using LinearAlgebra: norm; f()=(norm=1; norm)',errors:[{messageId:'unusedImport',data:{name:'norm'}}]},
  {code:'module A; using LinearAlgebra: norm; end; module B; norm=1; end',errors:[{messageId:'unusedImport',data:{name:'norm'}}]},
 ]
});
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { engine } from '../helpers.js';
test('unused imports count sibling reads across a custom include tree', async () => {
 const entry=fileURLToPath(new URL('../fixtures/packages/custom/entry.jl',import.meta.url));
 const [r]=await engine({'julia/no-unused-vars':'error'}).lintText('module Custom; using Dates: year, now; include("child.jl"); end',{filePath:entry});
 assert.deepEqual(r.messages,[]);
});
