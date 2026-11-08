import { tester, plugin } from '../helpers.js';
const bad = (code, output) => ({ code, output, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-redundant-type-assertion', plugin.rules['no-redundant-type-assertion'], {
  valid: ['(x::Integer)::Int', 'f(x::Int)::Int=x', '(x::next_type())::next_type()',
    'f(Int,x)=(x::Int)::Int', 'struct Ticket end; (x::Ticket)::Ticket',
    '((x::Int)::Int)=1', '@foo (x::Int)::Int', 'quote (x::Int)::Int end'],
  invalid: [bad('(x::Int)::Int', '(x::Int)'), bad('take!((x::String)::String)', 'take!((x::String))'),
    bad('f(x) where α = (x::α)::α', 'f(x) where α = (x::α)'),
    bad('(x::Base.Int)::Int', '(x::Base.Int)'),
    bad('import Base: Int as I; (x::I)::Int', 'import Base: Int as I; (x::I)'),
    bad('(x::Int):: # explanation\nInt', null)],
});
