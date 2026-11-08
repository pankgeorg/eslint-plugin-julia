import { tester, plugin } from '../helpers.js';
const bad = code => ({ code, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-duplicate-dict-keys', plugin.rules['no-duplicate-dict-keys'], {
  valid: ['Dict(:a=>1,:b=>2)', 'Dict{Any,Int}(1=>1,1.0=>2)',
    'f(Dict)=Dict(:a=>1,:a=>2)', 'f(var"=>")=Dict(:a=>1,:a=>2)',
    'Dict(:a=>1, "a"=>2)', 'Dict(:a=>1, xs..., :a=>2)',
    'Dict("$x"=>1,"$x"=>2)', 'Dict{Any,Int}(:a=>1,:a=>2)',
    '@foo Dict(:a=>1,:a=>2)', 'quote Dict(:a=>1,:a=>2) end',
    'Dict("\\xff"=>1,"ÿ"=>2)', 'Dict("""a"""=>1,"a"=>2)'],
  invalid: [bad('Dict(:a=>1,:a=>2)'), bad('Dict("host"=>1,"host"=>2)'),
    bad('Dict{String,Int}("port"=>80,"port"=>443)'), bad('Base.Dict(:α=>1,:α=>2)'),
    bad('Dict("\\u03b1"=>1,"α"=>2)'), bad('Dict("a\\n"=>1,"a\\n"=>2)'),
    bad('import Base: Dict as D; D(:a=>1,:a=>2)'),
    bad('Dict(""=>1,""=>2)'), bad('Dict("\\U0001f431"=>1,"🐱"=>2)'),
    bad('Dict("\\x61"=>1,"a"=>2)')],
});
