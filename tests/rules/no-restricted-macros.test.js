import { tester, plugin, engine } from '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const opts = (...entries) => [{ entries }];
const async = opts({ name: '@async' });
const threads = opts({ name: 'Threads.@threads', when: { argumentIndex: 0, argumentText: ':static' } });
const invalid = (code, options = async, count = 1) => ({ code, options, errors: Array.from({ length: count }, () => ({ messageId: 'restricted' })) });
tester.run('no-restricted-macros', plugin.rules['no-restricted-macros'], {
  valid: [
    '@async work()',
    { code: 'macro async(x); x; end; @async work()', options: async },
    { code: 'using Other: @async; @async work()', options: async },
    { code: 'CUDA.@sync work()', options: opts({ name: 'Base.@sync' }) },
    { code: 'quote @async work(); end; :(@async work())', options: async },
    { code: '@outer @async work()', options: async },
    { code: 'Threads.@threads :dynamic for x in xs; f(x); end', options: threads },
    { code: 'Threads.@threads for x in xs; f(x); end', options: threads },
    { code: 'module Threads; macro threads(x); x; end; end; Threads.@threads :static body', options: threads },
    { code: 'macro async(x); x; end', options: opts({ name: 'async', binding: 'spelling' }) },
    { code: 'using Other: @show; @show α', options: opts({ name: '@show' }) },
    { code: 'module Base; macro inbounds(x); x; end; end; Base.@inbounds a[i]', options: opts({ name: 'Base.@inbounds' }) },
  ],
  invalid: [
    invalid('@async work()'), invalid('Base.@async work()'),
    invalid('using Base: @async as @launch; @launch work()'),
    invalid('using Base: @async; @async work()'),
    invalid('import Base as B; B.@async work()'),
    invalid('Threads.@threads :static for α in xs; f(α); end', threads),
    invalid('Base.Threads.@threads :static for α in xs; f(α); end', threads),
    invalid('using Base.Threads: @threads as @parallel; @parallel :static body', threads),
    invalid('Base.@inbounds a[i]', opts({ name: '@inbounds' })),
    invalid('@generated f(x) = :(x)', opts({ name: 'Base.@generated' })),
    invalid('@show λ', opts({ name: '@show' })),
    invalid('@outer @async work()', [{ entries: [{ name: '@async' }], includeMacroPayloads: true }]),
    invalid('@async @async work()', async),
    invalid('@async @async work()', [{ entries: [{ name: '@async' }], includeMacroPayloads: true }], 2),
    invalid('macro async(x); x; end; @async work()', opts({ name: '@async', binding: 'spelling' })),
    invalid('Other.@trace_λ x', opts({ pattern: '@trace_*', binding: 'spelling' })),
    invalid('@show α', opts({ pattern: 'Base.@sh*' })),
    invalid('using Tracing: @record as @r; @r x', opts({ name: 'Tracing.@record' })),
  ],
});

test('macro restrictions validate their argument condition', async () => {
  for (const when of [
    { argumentIndex: -1, argumentText: ':static' },
    { argumentIndex: 0 },
    { argumentIndex: 0, argumentText: ':static', typo: true },
  ]) await assert.rejects(engine({ 'julia/no-restricted-macros': ['warn', { entries: [{ name: '@threads', when }] }] }).lintText('x', { filePath: 'x.jl' }));
});
