import { tester, plugin } from '../helpers.js';
const bad = (code, names, options) => ({
  code,
  ...(options ? { options: [options] } : {}),
  errors: names.map((name) => ({ messageId: 'missing', data: { name } })),
});
tester.run('no-undefined-exports', plugin.rules['no-undefined-exports'], {
  valid: [
    // `@enum` defines its type and instances (macro signature table).
    '@enum Color red; export Color, red',
    '@data Shape begin export Circle; Circle(); end',
    '@eval module M; export generated; end',
    'export f; function f end',
    'using LinearAlgebra; export norm',
    'module M; module Sub; export α; α=1; end; using .Sub; export α; end',
    'module M; export answer; const answer=42; end',
    'module M; using Base: length; export length; end',
    'public f; f()=1',
    'export @m; macro m(); end',
    'module M; export length; end',
    'module M; include("a.jl"); export fromfile; end',
    'using M; export maybe',
    'module M; Base.include(M,"a.jl"); export maybe; end',
    { code: 'export project', options: [{ globals: ['project'] }] },
    { code: 'using M; export foo', options: [{ moduleExports: { M: ['foo'] } }] },
    'quote export missingname; end',
    '@inline f()=1; export f',
  ],
  invalid: [
    bad('using LinearAlgebra; export definitely_absent', ['definitely_absent']),
    bad('module M; export absent; end', ['absent']),
    bad('module M; export answer; const anser=42; end', ['answer']),
    bad('module M; export helper; module Inner; helper()=1; end; end', ['helper']),
    bad('public 🐱', ['🐱']),
    bad('export var"a b"', ['a b']),
    bad('baremodule M; export sin; end', ['sin']),
    bad('module M; include("a.jl"); export x; end', ['x'], { includes: 'report' }),
    bad('using M; export x', ['x'], { unknownModules: 'report' }),
    bad('module M; export @m; end', ['@m']),
    bad('module A; f()=1; end; module B; export f; end', ['f']),
  ],
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from '../helpers.js';
import { fileURLToPath } from 'node:url';
test('undefined exports use resolved includes without skipping a typo', async () => {
  const entry = fileURLToPath(new URL('../fixtures/packages/custom/entry.jl', import.meta.url));
  const [r] = await engine({ 'julia/no-undefined-exports': 'error' }).lintText(
    'module Custom; include("child.jl"); export custom_value, typo; end',
    { filePath: entry },
  );
  assert.deepEqual(
    r.messages.map((m) => m.message),
    ['Exported name "typo" is not defined in this module.'],
  );
});
