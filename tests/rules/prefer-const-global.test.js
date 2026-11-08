import { tester, plugin } from '../helpers.js';
const bad=(code,name,output,options)=>({code,...(options?{options:[options]}:{}),errors:[{messageId:'constant',data:{name},suggestions:[{messageId:'add',output}]}]});
tester.run('prefer-const-global',plugin.rules['prefer-const-global'],{
 valid:['Alias=Union{Int,String}; f(x::Alias)=x',
'const threshold=10; f(x)=x>threshold','function f(); x=1; x+1; end',
 'const samples=[1,2]; f()=sum(samples)', 'scale::Float64=2.0; f(x)=scale*x',
 'x=1; x=2; f()=x','x::Int=1; f()=x','x=1', 'f()=(global x=1;x)',
 'if condition; x=1; end; f()=x', 'import M: x; f()=x',
 {code:'x=Dict(); f()=x',options:[{initializers:'literals'}]},'x=1; f()=(global x=2;x)',
 'x=1; include("a.jl"); f()=x','using M; x=1; f()=x',
 'quote x=1; f()=x; end','@custom x=1; f()=x',
 {code:'x=1; f()=x',options:[{mutableGlobals:['x']}]},
 ],invalid:[{"code": "x=1; f()=(global x; x)", "errors": [{"messageId": "constant", "data": {"name": "x"}, "suggestions": [{"messageId": "add", "output": "const x=1; f()=(global x; x)"}]}]},bad('scale=2; f(x)=scale*x','scale','const scale=2; f(x)=scale*x'),
 bad('cache=Dict(:a=>1); f(k)=get(cache,k,0)','cache','const cache=Dict(:a=>1); f(k)=get(cache,k,0)'),
 bad('samples=[1,2]; f()=sum(samples)','samples','const samples=[1,2]; f()=sum(samples)'),
bad('threshold=10; f(x)=x>threshold','threshold','const threshold=10; f(x)=x>threshold'),
 bad('TABLE=[1,2]; f(i)=TABLE[i]','TABLE','const TABLE=[1,2]; f(i)=TABLE[i]'),
 bad('module Settings; label="stable"; getlabel()=label; end','label','module Settings; const label="stable"; getlabel()=label; end'),
 bad('module M; var"a b"=1; f()=var"a b"; end','a b','module M; const var"a b"=1; f()=var"a b"; end'),
 bad('🐱=1; f()=🐱','🐱','const 🐱=1; f()=🐱'),
 bad('var"a b"=1; f()=var"a b"','a b','const var"a b"=1; f()=var"a b"'),
 bad('x=1; include("a.jl"); f()=x','x','const x=1; include("a.jl"); f()=x',{dynamicScopes:'strict-file'}),
 bad('x=Dict(); f()=x','x','const x=Dict(); f()=x',{initializers:'all'}),
 bad('x=(1,2); f()=x','x','const x=(1,2); f()=x')]
});
