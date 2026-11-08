import assert from 'node:assert/strict';
import { tester, plugin, engine } from '../helpers.js';
const restricted = { messageId: 'restricted', data: { message: 'Use the supported API.' } };
const entry = extra => ({ entries: [{ module: 'OldAPI', message: 'Use the supported API.', ...extra }] });
const invalid = (code, options, errors = [restricted]) => ({ code, options: [options], errors });
tester.run('no-restricted-imports', plugin.rules['no-restricted-imports'], {
  valid: [
    'using OldAPI; import OldAPI: run',
    { code: 'import FreshAPI as OldAPI', options: [entry()] },
    { code: 'import OldAPI.run', options: [entry({ names: ['run'] })] },
    { code: 'using .OldAPI: run', options: [entry()] },
    { code: 'using OldAPI', options: [entry({ names: ['run'] })] },
    { code: 'using OldAPI: safe as run', options: [entry({ names: ['run'] })] },
    { code: 'import OldAPI: run', options: [entry({ kind: 'using' })] },
    { code: 'using ..Parent: x; using Test', options: [{ requireExplicitNames: true, allowBareUsing: ['Test'] }] },
    { code: ':(using OldAPI); quote import OldAPI end; @eval using OldAPI', options: [entry()] },
    { code: 'quote using OldAPI end', options: [{ ...entry(), includeMacroPayloads: true }] },
    { code: 'using OldAPI.Inner.Deep', options: [entry({ module: undefined, modulePattern: 'OldAPI.*' })] },
    { code: 'using Outer.OldAPI', options: [entry({ module: undefined, modulePattern: 'Old*' })] },
    { code: 'using Test.Inner', options: [{ requireExplicitNames: false }] },
  ],
  invalid: [
    invalid('using OldAPI', entry()),
    invalid('import OldAPI as Current', entry()),
    invalid('import OldAPI.run', entry({ module: 'OldAPI.run' })),
    invalid('import OldAPI: run as launch', entry({ names: ['run'] })),
    invalid('using OldAPI: α as β', entry({ names: ['α'] })),
    invalid('using OldAPI: @trace as @record', entry({ names: ['@trace'] })),
    invalid('using OldAPI: +', entry({ names: ['+'] })),
    invalid('using OldAPI: var"odd name" as alias', entry({ names: ['odd name'] })),
    invalid('using OldAPI: one, two', entry()),
    invalid('using A.Inner, B.Inner', entry({ module: undefined, modulePattern: '?.Inner' })),
    invalid('using ..Parent: x', entry({ module: '..Parent' })),
    invalid('using Base: ENV', entry({ module: 'Base', names: ['ENV'] })),
    invalid('using .Sub', { requireExplicitNames: true }, [{ messageId: 'explicit', data: { module: '.Sub' } }]),
    invalid('using Test, Other', { requireExplicitNames: true, allowBareUsing: ['Test'] }, [{ messageId: 'explicit', data: { module: 'Other' } }]),
    invalid('import FreshAPI: f', { banImport: true }, [{ messageId: 'import' }]),
    invalid('@eval using OldAPI', { ...entry(), includeMacroPayloads: true }),
    invalid('using Λ.Inner', entry({ module: undefined, modulePattern: '?.Inner' })),
  ],
});
for (const options of [
  { entries: [{ module: 'A', modulePattern: '*', message: 'No.' }] },
  { entries: [{ module: 'A', names: [], message: 'No.' }] },
  { entries: [{ module: 'A' }] }, { unexpected: true }, { allowBareUsing: [1] },
]) await assert.rejects(engine({ 'julia/no-restricted-imports': ['warn', options] }).lintText('using A', { filePath: 'schema.jl' }));
