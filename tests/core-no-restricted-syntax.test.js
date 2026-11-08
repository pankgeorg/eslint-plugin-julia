import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import { tester } from './helpers.js';

// These strings are also used verbatim in docs/restricted-syntax.md. Exercise
// ESLint's actual core rule and selector traversal through the Julia language.
const examples = [
  {
    name: 'empty vectors',
    selector: 'vect[children.length=0]',
    valid: ['[1]', 'Int[]'],
    invalid: ['[]'],
  },
  {
    name: 'macros',
    selector: 'macrocall',
    valid: ['show(x)', '"@show x"'],
    invalid: ['@show x', 'Base.@show α'],
  },
  {
    name: 'call-site splatting',
    selector:
      ":matches(call, dotcall) > *[kind='...']:not(function > :first-child *):not(macro > :first-child *)",
    valid: [
      'f(xs...)=xs',
      'function f(xs...)::Int; 1; end',
      'f(xs...) where T = xs',
      'macro f(xs...); xs; end',
      'xs -> xs',
      '(xs...,)',
      'f([xs...])',
    ],
    invalid: ['send(xs...)', 'send.(xs...)', 'f(xs...)=send(xs...)', 'send(α...)'],
  },
  {
    name: 'return type annotations',
    selector:
      "function > *[kind='::']:first-child, function > where:first-child > *[kind='::']:first-child",
    valid: ['f(x::Int)=x', 'function f(x::Int); x; end', 'x::Int', 'f(x)=x::Int', 'f(x) where T=x'],
    invalid: ['f(x)::Int=x', 'function f(x)::Int; x; end', 'f(x)::T where T=x'],
  },
  {
    name: 'string multiplication',
    selector:
      "call[flags=136][children.1.value='*']:has(> string), call[children.0.value='*']:has(> string)",
    valid: ['a*b', 'f(*, "text")', 'string("text", a)', 'a .* "text"', 'a * raw"text"'],
    invalid: ['"key=" * value', 'value * "!"', '*("key=", value)', '"$α" * suffix'],
  },
  {
    name: 'untyped comprehensions',
    selector: 'comprehension',
    valid: ['Int[x for x in xs]', '(x for x in xs)', '[1,2]'],
    invalid: ['[x for x in xs]', '[x+y for x in xs, y in ys]', '[x for x in xs if x>0]'],
  },
  {
    name: 'terminal anonymous returns',
    selector:
      ":matches(do, *[kind='->']) > block:last-child > return:last-child, *[kind='->'] > return:last-child",
    valid: [
      'function f(x); return x; end',
      'x -> x',
      'map(xs) do x; x; end',
      'x -> begin; x>0 && return x; -x; end',
      'x -> begin; function f(); return 1; end; f(); end',
    ],
    invalid: [
      'map(xs) do x; return x; end',
      'x -> begin; touch(x); return x; end',
      'x -> return x',
      'map(xs) do x\n return x # trailing comment\nend',
    ],
  },
  {
    name: 'Vector Any',
    selector:
      "curly[children.length=2][children.0.value='Vector'][children.1.value='Any'], curly[children.length=2][children.0.kind='.'][children.0.children.0.value='Base'][children.0.children.1.value='Vector'][children.1.value='Any']",
    valid: ['Vector{Int}', 'Matrix{Any}', 'Vector{T}', 'Other.Vector{Any}'],
    invalid: ['Vector{Any}', 'Base.Vector{Any}', 'function f(Vector); Vector{Any}; end'],
  },
  {
    name: 'explicit quote and macro exclusions',
    selector: 'vect[children.length=0]:not(quote *):not(inert *):not(macrocall *)',
    valid: [':([])', 'quote; []; end', '@custom []'],
    invalid: ['[]'],
  },
  {
    name: 'core selectors see quoted and macro syntax by default',
    selector: 'vect[children.length=0]',
    valid: ['"[]"'],
    invalid: [':([])', 'quote; []; end', '@custom []'],
  },
];
for (const { name, selector, valid, invalid } of examples) {
  tester.run(`core no-restricted-syntax: ${name}`, builtinRules.get('no-restricted-syntax'), {
    valid: valid.map((code) => ({
      code,
      options: [{ selector, message: 'Project syntax policy.' }],
    })),
    invalid: invalid.map((code) => ({
      code,
      options: [{ selector, message: 'Project syntax policy.' }],
      errors: [{ messageId: 'restrictedSyntax', data: { message: 'Project syntax policy.' } }],
    })),
  });
}

test('every tested policy selector appears verbatim in the guide', () => {
  const guide = readFileSync(new URL('../docs/restricted-syntax.md', import.meta.url), 'utf8');
  for (const { selector } of examples) assert.ok(guide.includes(selector), selector);
});
