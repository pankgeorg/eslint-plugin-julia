import { tester, plugin, engine } from '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const opts = (...entries) => [{ entries }];
const sleep = opts({ name: 'sleep' });
const unsafe = opts({ pattern: 'unsafe_*' });
const arity = opts({ name: 'sleep', minArgs: 1, maxArgs: 1 });
const threads = opts({ name: 'Threads.nthreads', context: 'const-initializer', maxArgs: 0 });
const invalid = (code, options = sleep, count = 1) => ({ code, options, errors: Array.from({ length: count }, () => ({ messageId: 'restricted' })) });
tester.run('no-restricted-calls', plugin.rules['no-restricted-calls'], {
  valid: [
    'sleep(1)',
    { code: 'f(sleep) = sleep(1)', options: sleep },
    { code: 'function f(); sleep = identity; sleep(1); end', options: sleep },
    { code: 'sleep(x) = x; sleep(1)', options: sleep },
    { code: 'using Elsewhere: sleep; sleep(1)', options: sleep },
    { code: 'using Elsewhere: sleep as nap; nap(1)', options: sleep },
    { code: 'f(Base) = Base.sleep(1)', options: sleep },
    { code: 'module Base; sleep(x)=x; end; Base.sleep(1)', options: sleep },
    { code: 'function sleep(x); x; end; map(sleep, xs)', options: sleep },
    { code: 'quote sleep(1); end; :(Base.sleep(1))', options: sleep },
    { code: '@time sleep(1)', options: sleep },
    { code: 'sleep(); sleep(1, 2); sleep(xs...)', options: arity },
    { code: 'unsafe_local(x)=x; unsafe_local(1)', options: unsafe },
    { code: 'sleep.unsafe_load(p)', options: unsafe },
    { code: 'using Other: object; object.unsafe_load(p)', options: unsafe },
    { code: 'Threads.nthreads(); const f = () -> Threads.nthreads()', options: threads },
    { code: 'const f = map(xs) do x; Threads.nthreads(); end', options: threads },
    { code: 'f(Threads) = Threads.nthreads(); const f = 1', options: threads },
    { code: 'const x = other.nthreads()', options: threads },
    { code: 'f(x)=x; f(1)', options: opts({ name: 'Other.f' }) },
    { code: 'using Other; sleep(1)', options: sleep },
    { code: 'import Other: Base; Base.sleep(1)', options: sleep },
    { code: 'function unsafe_入口(p); unsafe_load(p); end', options: opts({ pattern: 'unsafe_*', exceptWithinFunctions: ['unsafe_*'] }) },
  ],
  invalid: [
    invalid('f(x=sleep(1))=x'),
    { ...invalid('sleep(1)\nfetch_raw(pointer_value)', opts({ name: 'Base.sleep' }, { name: 'Base.unsafe_load' })),
      filename: fileURLToPath(new URL('../fixtures/restricted/consumer.jl', import.meta.url)),
      settings: { julia: { entryFiles: [fileURLToPath(new URL('../fixtures/restricted/entry.jl', import.meta.url))] } } },
    invalid('sleep(1)'), invalid('Base.sleep(1)'),
    invalid('using Base: sleep as nap; nap(1)'),
    invalid('import Base as B; B.sleep(1)'),
    invalid('using Base: sleep; sleep(1)'),
    invalid('sleep.(xs)'), invalid('Base.sleep.(xs)'),
    invalid('sleep(1; timer=2); sleep(1, timer=2)', arity, 2),
    invalid('finalizer(obj) do item; close(item); end', opts({ name: 'finalizer', minArgs: 2, maxArgs: 2 })),
    invalid('x ∈ xs; x .∈ xs; ∈(x,xs)', opts({ name: '∈', minArgs: 2, maxArgs: 2 }), 3),
    invalid('Base.:+(x,y)', opts({ name: '+' })),
    invalid('Task{T}(f); Base.Task(f)', opts({ name: 'Core.Task' }), 2),
    invalid('const n = 2 * Threads.nthreads()', threads),
    invalid('const n = Base.Threads.nthreads()', threads),
    invalid('using Base.Threads: nthreads as nt; const n = nt()', threads),
    invalid('Base.unsafe_load(p); unsafe_load(p)', unsafe, 2),
    invalid('Base.uv_unref(handle)', opts({ pattern: 'Base.uv_*' })),
    invalid('f(sleep)=sleep(1)', opts({ name: 'sleep', binding: 'spelling', message: 'Use the delay wrapper.' })),
    invalid('unsafe_読み(p)', opts({ pattern: 'unsafe_??', binding: 'spelling' })),
    invalid('Other.unsafe_read(p)', opts({ pattern: 'unsafe_*', binding: 'spelling' })),
    invalid('function wrap(p); unsafe_load(p); end', opts({ pattern: 'unsafe_*', exceptWithinFunctions: ['unsafe_*'] })),
    invalid('@time sleep(1)', [{ entries: [{ name: 'Base.sleep' }], includeMacroPayloads: true }]),
    invalid('sleep(xs...)', sleep),
    invalid('using Other: pause as nap; nap(1)', opts({ name: 'Other.pause' })),
    invalid('import Other; Other.pause(1)', opts({ name: 'Other.pause' })),
  ],
});

test('restriction schemas reject ambiguous entries and unknown options', async () => {
  for (const options of [
    { entries: [{ name: 'sleep', pattern: '*' }] },
    { entries: [{}] },
    { entries: [{ name: 'sleep', minArgs: -1 }] },
    { entries: [{ name: 'sleep', binding: 'guess' }] },
    { entries: [{ name: 'sleep', typo: true }] },
    { includeMacroPayloads: 'yes' },
    { typo: true },
  ]) await assert.rejects(engine({ 'julia/no-restricted-calls': ['warn', options] }).lintText('sleep(1)', { filePath: 'x.jl' }));
});
