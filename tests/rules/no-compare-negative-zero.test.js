import { tester, plugin } from '../helpers.js';
const bad = (code, output) => ({
  code,
  errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }],
});
tester.run('no-compare-negative-zero', plugin.rules['no-compare-negative-zero'], {
  valid: [
    'x===-0.0',
    'x!==-0.0',
    'isequal(x,-0.0)',
    'x < -0.0',
    'x .== -0.0',
    'x == -0',
    'x == -1e-999',
    'f(var"==",x)=x == -0.0',
    '@foo x == -0.0',
    'quote x == -0.0 end',
  ],
  invalid: [
    bad('x == -0.0', 'Base.isequal(x, -0.0)'),
    bad('-0.0 != x', '!Base.isequal(-0.0, x)'),
    bad('α == -0.0f0', 'Base.isequal(α, -0.0f0)'),
    bad('x == (-0.0)', 'Base.isequal(x, (-0.0))'),
    { code: 'f(Base,x)=x == -0.0', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
  ],
});
