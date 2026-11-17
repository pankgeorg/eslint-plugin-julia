import { tester, plugin } from '../helpers.js';
const bad = (code, output) => ({
  code,
  errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }],
});
tester.run('no-redundant-union-members', plugin.rules['no-redundant-union-members'], {
  valid: [
    'Union{Int,String}',
    'Union{Int,Int64}',
    'f(Union)=Union{Int,Int}',
    'f(Int)=Union{Int,Int}',
    'Union{next_type(),next_type()}',
    'struct Ticket end; Union{Ticket,Ticket}',
    '@foo Union{Int,Int}',
    'quote Union{Int,Int} end',
  ],
  invalid: [
    bad('Union{Int,Int}', 'Union{Int}'),
    bad('Union{String,String,Int}', 'Union{String,Int}'),
    bad('f(x) where α = Union{α,α}', 'f(x) where α = Union{α}'),
    bad('Union{Base.Int,Int}', 'Union{Base.Int}'),
    bad('import Base: Int as I; Union{I,Int}', 'import Base: Int as I; Union{I}'),
    {
      code: 'Union{Int, # retain explanation\nInt}',
      errors: [{ messageId: 'diagnostic', suggestions: [] }],
    },
  ],
});
