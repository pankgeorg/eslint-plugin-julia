import { tester, plugin } from '../helpers.js';
const invalid = (code, output) => ({ code, errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }] });
tester.run('prefer-extreme-over-sort', plugin.rules['prefer-extreme-over-sort'], {
  valid: [
    'sort([3,1])[1]=2',
    'sort([3,1])[1]+=2',
    '(sort([3,1])[1], a)=pair',
    'f(v)=sort(v)[1]',
    'sort([NaN,1.0])[1]',
    'sort([missing,1])[end]',
    'sort([3,1]; rev=true)[1]',
    'sort([3,1]; by=abs)[end]',
    'sort!([3,1])[1]',
    'sort(Int[])[1]',
    'sort([3,1])[2]',
    'f(sort)=sort([3,1])[1]',
    'f(Int)=sort(Int[3,1])[1]',
    'module M; Vector=Custom; f(x::Vector{Int})=sort(x)[1]; end',
    'f(x::Vector{Float64})=sort(x)[end]',
    'function f(); a=Int[3,1]; a=unknown(); sort(a)[1]; end',
    '@m sort([3,1])[1]',
    'quote sort([3,1])[1] end',
  ],
  invalid: [
    invalid('f(Vector,x::Vector{Int})=sort(x)[1]', 'f(Vector,x::Vector{Int})=Base.minimum(x)'),
    invalid('sort([3,1,2])[1]', 'Base.minimum([3,1,2])'),
    invalid('let α=Int[4,2,7]; sort(α)[end]; end', 'let α=Int[4,2,7]; Base.maximum(α); end'),
    invalid('f(α::Vector{Int})=sort(α)[1]', 'f(α::Vector{Int})=Base.minimum(α)'),
    invalid('f(x::Base.Vector{Base.Int})=Base.sort(x)[end]', 'f(x::Base.Vector{Base.Int})=Base.maximum(x)'),
    { code: 'sort([3, # retain\n 1])[1]', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
  ],
});
