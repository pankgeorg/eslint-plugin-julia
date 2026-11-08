import { tester, plugin } from '../helpers.js';
const bad = (code, names, options) => ({
  code,
  ...(options ? { options: [options] } : {}),
  errors: names.map((name) => ({ messageId: 'unbound', data: { name } })),
});
tester.run('no-unbound-type-parameters', plugin.rules['no-unbound-type-parameters'], {
  valid: [
    'f(@nospecialize _::Type{A}) where {T,A<:Vector{T}}=T',
    'f(x::S::T) where {S,T}=x',
    'f(x::T) where T=x',
    'f(x::S) where {T,S<:AbstractVector{T}}=x',
    'f(::Type{T}) where T=T',
    'f(x::Tuple{T,T}) where T=x',
    'f(x::S) where {T,U<:Vector{T},S<:Vector{U}}=x',
    'struct Tag{T} end',
    'f(x::T=zero(T)) where T=x',
    'f(x::T...) where T=x',
    '(f::F)(x) where {T,F}=x',
    'quote f(x) where T=x; end',
    { code: 'f(x) where T=x', options: [{ ignoreParameters: ['T'] }] },
    { code: 'f(x;y::T=1) where T=y', options: [{ checkKeywords: true }] },
  ],
  invalid: [
    bad('f(x) where T=x', ['T']),
    bad('f(x::S) where {S,T}=x', ['T']),
    bad('f(x;y::T=1) where T=y', ['T']),
    bad('function f(x)::T where T; x; end', ['T']),
    bad('f(x) where T=T', ['T']),
    bad('f(x) where {T<:Real}=x', ['T']),
    bad('f(x) where 🐱=x', ['🐱']),
    bad('@inline f(x) where T=x', ['T']),
    bad('function f(x::S) where {T,S}; T; end', ['T']),
    bad('f(x=1) where T=x', ['T'], { checkComplexSignatures: true }),
  ],
});
