import { fileURLToPath } from 'node:url';
import { tester, plugin } from '../helpers.js';
const filename = fileURLToPath(
  new URL('../fixtures/packages/PathDep/src/PathDep.jl', import.meta.url),
);
const bad = (code) => ({ code, filename, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-obvious-type-piracy', plugin.rules['no-obvious-type-piracy'], {
  valid: [
    ...[
      'struct Ticket; id::Int; end; Base.length(x::Ticket)=1',
      'my_length(x::Int)=1',
      'Base.show(io::IO, ::MIME"text/custom", x::Vector{Int})=print(io,x)',
      'Base.length(x::Vector{Int})=1',
      'Base.length(x::T) where T=1',
      'Base.length(x::Int; kw=1)=1',
      'Base.length(x::Int=1)=1',
      'Base.length(xs::Int...)=1',
      'Base.length()=1',
      'module Base; length(x::Int)=1; end',
      'module Local; const Base=Other; Base.length(x::Int)=1; end',
      '@foo Base.length(x::Int)=1',
      'quote Base.length(x::Int)=1 end',
      'Base.Int(x::String)=1',
    ].map((code) => ({ code, filename })),
    'Base.length(x::Int)=1', // Unknown project owner: skip.
  ],
  invalid: [
    bad('Base.length(x::Int)=1'),
    bad('Base.isempty(x::String)=true'),
    bad('Base.copy(α::Int)=α'),
    bad('Base.length(x)=1'),
    bad('function Base.length(::Core.Int); 1; end'),
  ],
});
