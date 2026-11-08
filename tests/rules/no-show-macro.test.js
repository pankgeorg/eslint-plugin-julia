import { tester, plugin } from '../helpers.js';
const bad = (code, output, name = '@show') => ({ code, errors: [{ messageId: 'debug', data: { name },
  suggestions: output ? [{ messageId: 'remove', output }] : [],
}] });
tester.run('no-show-macro', plugin.rules['no-show-macro'], {
  valid: [
    'println("diagnostic")', 'Other.@show x', ':(@show x); quote; Base.@show x; end',
    'macro show(x); x; end; @show x',
    'module M; macro showtime(x); x; end; @showtime x; end',
    'module M; module Base; macro show(x); x; end; end; Base.@show x; end',
    'using Other: @show; @show x', 'using Other: @peek; @peek x',
    '@wrapper @show x',
    { code: '@show x; Base.@showtime work()', options: [{ allow: ['show', '@showtime'] }] },
    { code: 'using Base: @show as @δ; @δ x', options: [{ allow: ['@show'] }] },
  ],
  invalid: [
    bad('@show x', '(x)'),
    bad('Base.@show α', '(α)'),
    bad('function f(Base); Base.@show x; end', 'function f(Base); (x); end'),
    bad('@showtime work()', '(work())', '@showtime'),
    bad('function f(🐱); @show 🐱; next(); end', 'function f(🐱); (🐱); next(); end'),
    bad('using Base: @show as @δ; @δ x', 'using Base: @show as @δ; (x)'),
    bad('import Base as B; B.@show x', 'import Base as B; (x)'),
    bad('result = @show work()', null),
    bad('@show a b', null),
    bad('(@show work()); next()', '((work())); next()'),
    { code: '@show x; @showtime f()', options: [{ allow: ['show'] }],
      errors: [{ messageId: 'debug', data: { name: '@showtime' }, suggestions: [{ messageId: 'remove', output: '@show x; (f())' }] }] },
  ],
});
