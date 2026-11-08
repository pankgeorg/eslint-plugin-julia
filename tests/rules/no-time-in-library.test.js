import { tester, plugin } from '../helpers.js';
const filename = '/project/src/api.jl';
const invalid = code => ({ code, filename, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-time-in-library', plugin.rules['no-time-in-library'], {
  valid: [
    { code: 'f()=@elapsed work()', filename },
    { code: 'quote @time work() end', filename },
    { code: 'macro m(); @time work(); end', filename },
    { code: '@m @time work()', filename },
    { code: 'module M; macro time(x); x; end; @time work(); end', filename },
    { code: 'module M; Base=Other; Base.@time work(); end', filename },
    { code: 'f()="@time work()" # @time work()', filename },
    { code: 'baremodule M; @time work(); end', filename },
  ],
  invalid: [
    invalid('f()=@time work()'),
    invalid('module Library; const data=@time load_data(); end'),
    invalid('f(α)=Base.@time consume(α)'),
    invalid('using Base: @time as @measure; @measure work()'),
    invalid('f(Base)=Base.@time work()'),
  ],
});
