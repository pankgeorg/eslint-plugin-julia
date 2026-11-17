import { tester, plugin } from '../helpers.js';
const invalid = (code, output) => ({
  code,
  errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }],
});
tester.run('prefer-size-dimension', plugin.rules['prefer-size-dimension'], {
  valid: [
    'size(x)[1]=2',
    'size(x)[1]+=2',
    '(size(x)[1], a)=pair',
    'f(x)=size(x,1)',
    'f(x)=size(x)[1:2]',
    'f(x,d)=size(x)[d]',
    'f(x)=size(x,1)[1]',
    'f(x)=size(x)[0]',
    'f(x)=size(x)[-1]',
    'f(size,x)=size(x)[1]',
    '@m size(x)[1]',
    'quote size(x)[1] end',
    'size(xs...)[1]',
    'size(x=xs)[1]',
    'size(x; option=true)[1]',
  ],
  invalid: [
    invalid('f(x)=size(x)[1]', 'f(x)=Base.size(x, 1)'),
    invalid('f(α)=Base.size(α)[2]', 'f(α)=Base.size(α, 2)'),
    invalid('f(x)=size(x)[3]', 'f(x)=Base.size(x, 3)'),
    { code: 'f(x)=size(x # retain\n )[1]', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
    { code: 'f(Base,x)=size(x)[1]', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
  ],
});
