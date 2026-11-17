import assert from 'node:assert/strict';
import { tester, plugin, engine } from '../helpers.js';
const invalid = (code, options) => ({
  code,
  ...(options && { options: [options] }),
  errors: [{ messageId: 'mutation' }],
});
tester.run('no-env-mutation', plugin.rules['no-env-mutation'], {
  valid: [
    'value=ENV["TRACE"]; get(ENV,"TRACE","")',
    'withenv("TRACE"=>"yes") do; work(); end',
    'function f(ENV); ENV["TRACE"]="yes"; delete!(ENV,"TRACE"); end',
    'let ENV=Dict(); pop!(ENV,"κ",nothing); end',
    'ENV=Dict(); ENV["key"]="value"',
    'function f(Base); Base.empty!(Base.ENV); end',
    'function f(empty!); empty!(ENV); end',
    'module M; delete!(x,y)=nothing; delete!(ENV,"TRACE"); end',
    'quote ENV["TRACE"]="yes"; end; :(empty!(ENV))',
    '@custom ENV["TRACE"]="yes"',
    {
      code: 'module M; function __init__(); ENV["TRACE"]="yes"; end; end',
      options: [{ allowInInit: true }],
    },
    { code: '__init__() = (ENV["TRACE"]="yes")', options: [{ allowInInit: true }] },
    'using Other: ENV; ENV["key"]="value"',
    'using Other: delete!; delete!(ENV,"key")',
    'using Base: ENV as environment; function f(environment); empty!(environment); end',
    'copy=ENV; empty!(copy)',
    'delete!(ENV, k) = error("method definition")',
  ],
  invalid: [
    invalid('ENV["TRACE"]="yes"'),
    invalid('Base.ENV["κ"]="λ"'),
    invalid('ENV["TRACE"] *= "more"'),
    ...[
      'delete!(ENV,"TRACE")',
      'pop!(ENV,"TRACE")',
      'pop!(ENV,"TRACE",nothing)',
      'get!(ENV,"TRACE","yes")',
      'push!(ENV,"TRACE"=>"yes")',
      'empty!(ENV)',
      'merge!(ENV,Dict("TRACE"=>"yes"))',
      'setindex!(ENV,"yes","TRACE")',
      'Base.delete!(Base.ENV,"κ")',
      'Base.pop!(ENV,"TRACE",nothing)',
      'Base.get!(ENV,"TRACE","yes")',
      'Base.push!(ENV,"TRACE"=>"yes")',
      'Base.empty!(Base.ENV)',
      'Base.merge!(ENV,settings)',
      'Base.setindex!(ENV,"yes","TRACE")',
      'get!(() -> "yes", ENV, "TRACE")',
      'get!(ENV,"TRACE") do; "yes"; end',
    ].map((code) => invalid(code)),
    invalid('using Base: empty! as clear; clear(ENV)'),
    invalid('using Base: ENV as environment; Base.empty!(environment)'),
    invalid('module M; __init__()=(ENV["TRACE"]="yes"); end'),
    invalid('module M; ENV["TRACE"]="yes"; end', { allowInInit: true }),
    invalid('function outer(); function __init__(); empty!(ENV); end; end', { allowInInit: true }),
    invalid('module M; function __init__(); later=()->empty!(ENV); end; end', {
      allowInInit: true,
    }),
    invalid('module M; function __init__(x); empty!(ENV); end; end', { allowInInit: true }),
    invalid('function f(ENV); Base.empty!(Base.ENV); end'),
  ],
});
await assert.rejects(
  engine({ 'julia/no-env-mutation': ['warn', { allowInInit: 'yes' }] }).lintText('empty!(ENV)', {
    filePath: 'schema.jl',
  }),
);
