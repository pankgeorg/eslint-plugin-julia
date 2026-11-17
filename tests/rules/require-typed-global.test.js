import assert from 'node:assert/strict';
import { tester, plugin, engine } from '../helpers.js';
const invalid = (code, name) => ({ code, errors: [{ messageId: 'typed', data: { name } }] });
tester.run('require-typed-global', plugin.rules['require-typed-global'], {
  valid: [
    'x=1; f()=x',
    'x=1; x=2; println(x)',
    'const x=1; f()=x',
    'x::Int=1; x=2; f()=x',
    'global x::Int=0; f()=(global x=2; x)',
    'global x::Int; x=0; x=1; f()=x',
    'function f(); x=0; x=1; x; end',
    'x=0; x=1; f(x)=x',
    'x=0; x=1; f()=(local x=2; x)',
    'x=0; x=1; f(y::x)=y',
    'quote x=0; x=1; f()=x; end',
    '@custom begin x=0; x=1; f()=x; end',
    'x=0; x=1; f()=:(x)',
    'x=0; x=1; f()=(@custom x)',
    'using Base: ENV; f()=ENV',
    'import Other: x; x=1; x=2; f()=x',
    'global x=0; f()=(global x=1)',
    'x=0; x=1; module Inner; f()=x; end',
    { code: 'α=0; α=1; f()=α', options: [{ allow: ['α'] }] },
  ],
  invalid: [
    invalid('x=0; x=1; f()=x', 'x'),
    invalid('module M; state=0; state=1; read()=state; end', 'state'),
    invalid('global α=0; f()=(global α=2; α)', 'α'),
    invalid('function f(); global count=1; count; end', 'count'),
    invalid('x=0; f()=(global x; x+=1)', 'x'),
    invalid('x=0; f()=(global x; x=1; x)', 'x'),
    invalid('var"odd name"=0; var"odd name"=1; f()=var"odd name"', 'odd name'),
    invalid('module M; x=0; x=1; f()=()->x; end', 'x'),
    invalid('x=0; if enabled; x=1; end; f()=x', 'x'),
  ],
});
// The two rules must partition bindings even with the broader const settings.
for (const code of ['x=0; x=1; f()=x', 'f()=(global x=1; x)', 'x=1; f()=x']) {
  const [result] = await engine({
    'julia/prefer-const-global': ['warn', { dynamicScopes: 'strict-file' }],
    'julia/require-typed-global': 'warn',
  }).lintText(code, { filePath: 'globals.jl' });
  assert.equal(result.messages.length, 1);
}
await assert.rejects(
  engine({ 'julia/require-typed-global': ['warn', { allow: [''] }] }).lintText('x=0', {
    filePath: 'schema.jl',
  }),
);
