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
