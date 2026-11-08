import { tester, plugin } from '../helpers.js';
const invalid = (code, output) => ({ code, errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }] });
tester.run('prefer-generator-sum', plugin.rules['prefer-generator-sum'], {
  valid: [
    'sum(x*x for x in xs)',
    'sum(Int[x for x in xs])',
    'sum([x+y for x in xs, y in ys])',
    'sum([x for x in xs if x>0])',
    'sum([x for x in xs for y in ys])',
    'sum([x for x in xs]; init=0)',
    'sum.([x for x in xs])',
    'f(sum,xs)=sum([x for x in xs])',
    '@m sum([x for x in xs])',
    'quote sum([x for x in xs]) end',
    'sum([@m(x) for x in xs])',
  ],
  invalid: [
    invalid('f(xs)=sum([x*x for x in xs])', 'f(xs)=sum((x*x for x in xs))'),
    invalid('f()=Base.sum([i+1 for i in 1:100])', 'f()=Base.sum((i+1 for i in 1:100))'),
    invalid('f(α)=sum([abs(β) for β in α])', 'f(α)=sum((abs(β) for β in α))'),
    { code: 'sum([x # retain\n for x in xs])', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
  ],
});
