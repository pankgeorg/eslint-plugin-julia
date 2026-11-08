import assert from 'node:assert/strict';
import { tester, plugin, engine } from '../helpers.js';
const invalid = (code, name) => ({ code, errors: [{ messageId: 'typed', data: { name }, suggestions: [] }] });
tester.run('prefer-typed-empty-array', plugin.rules['prefer-typed-empty-array'], {
  valid: [
    '[]; isempty([]); f()==[]; @test f()==[]',
    'function f(); x=[]; isempty(x); x; end',
    'f()=[]; cache.items=[]',
    'function f(); x=Int[]; push!(x,1); x; end',
    'function f(push!); x=[]; push!(x,1); end',
    'function f(Base); x=[]; Base.push!(x,1); end',
    'function f(); x=[]; x=Int[]; push!(x,1); end',
    'function f(); x=[]; let x=[]; isempty(x); end; end',
    'function f(); x=[]; let x=Int[]; push!(x,1); end; end',
    '@custom begin x=[]; push!(x,1); end',
    'quote x=[]; push!(x,1); end; :(push!([],1))',
    'function f(); x=[]; @custom push!(x,1); end',
    'function f(); x=[]; ()->push!(x,1); end',
    'function f(); x::Vector{Int}=[]; push!(x,1); end',
    'function f(); x=[]; for i in 1:100; push!(x,i); end; end',
    'using Other: append!; x=[]; append!(x,items)',
    'function f(); push!(x,1); x=[]; end',
    'function f(;x=[]); push!(x,1); end',
  ],
  invalid: [
    invalid('function f(); x=[]; push!(x,1); x; end', 'x'),
    invalid('function f(items); α=[]; for item in items; Base.push!(α,item); end; α; end', 'α'),
    invalid('x=[]; append!(x,items); cache.items=x', 'x'),
    invalid('function f(); var"odd name"=([]); pushfirst!(var"odd name",1); end', 'odd name'),
    invalid('function f(items); x=[]; prepend!(x,items); end', 'x'),
    invalid('using Base: push! as add; function f(); x=[]; add(x,1); end', 'x'),
    invalid('function f(); x=[]; push!((x),1); end', 'x'),
    invalid('function f(); x=[]; push!(x,1); push!(x,2); end', 'x'),
  ],
});
for (const minimumIterations of [1, 16]) {
  const [result] = await engine({ 'julia/prefer-typed-empty-array': 'warn',
    'julia/prefer-sized-push-buffer': ['warn', { minimumIterations }] }).lintText(
    'function f(); x=[]; for i in 1:100; push!(x,i); end; x; end', { filePath: 'buffers.jl' });
  assert.deepEqual(result.messages.map(m => m.ruleId), ['julia/prefer-sized-push-buffer']);
}
