import { tester, plugin } from '../helpers.js';
const bad=(code,names,options)=>({code,...(options?{options:[options]}:{}),errors:names.map(name=>({messageId:'undefined',data:{name}}))});
tester.run('no-undef',plugin.rules['no-undef'],{
 valid:[
  '@dsl [unknown for i in xs]', '@dsl for i in xs; unknown; end',
  '@isdefined(x)', 'f() = @isdefined(local_name)',
  'using Dates; year(now())', 'import LinearAlgebra; norm([1, 2])',
  'module M; module Sub; export α; α=1; end; using .Sub; α; end',
  'ccall(:f, Int, ())', 'f(A)=A[begin:end]', 'const Alias{T}=Vector{T}',
  'macro m(); __module__; __source__; end', 'f(@nospecialize x)=x',
  'f(x::T) where {Int<:T<:Real}=x',
  'using LinearAlgebra: norm; norm([1,2])','function f(x); y=x+1; y; end',
  'using LinearAlgebra; norm([1,2])', 'f()=(x; x=1)', 'f(x)=(a=x; ()->a)',
  'f(x; kw=1)=x+kw', 'f(x::T) where T=x', 'struct X{T}; field::T; end',
  'f(x)=x.field', 'f(x)=g(;key=x); g(;key)=key', 'f(x)=(; key=x)',
  '@enum Shade light dark', '@show x', 'quote x; end',
  'x=1; :($x)', 'var"a b"=1; var"a b"', 'module M; f()=M; end',
  {code:'using M; foo()',options:[{unknownModules:'report',moduleExports:{M:['foo']}}]},
  {code:'f()=project_name',options:[{globals:['project_name']}]},
  {code:'unknown()',options:[{unknownGlobals:'ignore'}]},
 ],invalid:[
  bad('function f(x); x+offest; end',['offest']),
  bad('f()=missing_helper(1)',['missing_helper']),
  bad('using LinearAlgebra; @enum Fruit apple pear; apple',['apple']),
  bad('module A; using UnknownModule; mystery; end; module B; typo; end',['typo']),
  bad('module A; using Dates; end; module B; year; end',['year']),
  bad('using UnknownModule; typo',['typo'],{unknownModules:'report'}),
  bad('using LinearAlgebra; norm([1,2]); typo()',['typo'],{unknownModules:'report'}),
  bad('@enum Shade light dark; light',['light']),
  bad('f()=🐱',['🐱']), bad('include("a.jl"); from_file()',['from_file']),
  bad('eval(:(x=1)); x',['x']), bad('baremodule M; sin(1); end',['sin']),
  bad('x=1; module M; x; end',['x']), bad('f(a=x,x=1)=a',['x']),
  bad('f()=(let x=x; x; end)',['x']), bad('f(;kw=missing_default)=kw',['missing_default']),
  bad('struct X <: Unknown; field::MissingType; end',['Unknown','MissingType']),
  bad('f(x::T) where T<:Unknown=x',['Unknown']), bad('for x in x; x; end',['x']),
  bad('f()=:(a+$b)',['b']), bad('@inline f(x)=x+unknown',['unknown']),
  bad('using M; bad()',['bad'],{moduleExports:{M:['good']}}),
 ]
});

// Exercise ESLint's actual physicalFilename plumbing, rather than only the scope API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { engine } from '../helpers.js';
test('no-undef resolves sibling includes with real filePath and settings', async () => {
 const entry=fileURLToPath(new URL('../fixtures/packages/custom/entry.jl',import.meta.url));
 const child=fileURLToPath(new URL('../fixtures/packages/custom/child.jl',import.meta.url));
 const eslint=engine({'julia/no-undef':'error'},{overrideConfig:[{
  files:['**/*.jl'],plugins:{julia:plugin},language:'julia/julia',
  settings:{julia:{entryFiles:[entry]}},rules:{'julia/no-undef':'error'},
 }]});
 const [result]=await eslint.lintText(readFileSync(child,'utf8'),{filePath:child});
 assert.deepEqual(result.messages,[]);
});
