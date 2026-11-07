import { tester, plugin } from '../helpers.js';
const bad=(code,names,options)=>({code,...(options?{options:[options]}:{}),errors:names.map(name=>({messageId:'unused',data:{name}}))});
tester.run('no-unused-type-parameters',plugin.rules['no-unused-type-parameters'],{
 valid:[{"code": "@dsl f(x) where T=x", "options": [{"ignoreFunctionsWithDynamicCode": true}]},'typeid(::Type{T}) where T=T','struct Tag{T} end',
 'f(x::T) where T=x','function f(x)::T where T; x; end','f(x) where T=T',
 'f(x::S) where {T,S<:AbstractVector{T}}=x','f(x) where T=@show T',
 'f(x) where T=(() -> T)','quote f(x) where T=x; end',
 {code:'f(x) where T=x',options:[{ignoreParameters:['T']}]},
 {code:'f(x) where T=(eval(:T);x)',options:[{ignoreFunctionsWithDynamicCode:true}]},
 'struct X{T}; field::T; end',
 ],invalid:[bad('f(x) where T=x',['T']),bad('f(x::S) where {S,T}=x',['T']),
 bad('function f(x) where {T<:Real}; x; end',['T']),
 bad('f(x) where T=(g(T)=T; g(x))',['T']),
 bad('f(x) where T=:(T)',['T']),bad('f(x) where 🐱=x',['🐱']),
 bad('@inline f(x) where T=x',['T']),bad('struct Tag{T} end',['T'],{checkStructs:true}),
 bad('f(x) where T=(eval(:T);x)',['T']),bad('f(x) where {T<:Vector{T}}=x',['T'])]
});
