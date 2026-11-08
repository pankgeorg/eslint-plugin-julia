import { tester, plugin } from '../helpers.js';
import { fileURLToPath } from 'node:url';
const fixture = name => fileURLToPath(new URL(`../fixtures/count-context/${name}.jl`, import.meta.url));
const invalid = (code, output) => ({ code, errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }] });
tester.run('prefer-count-over-findall-length', plugin.rules['prefer-count-over-findall-length'], {
  valid: [
    { code: 'f(xs) = length(findall(isodd, xs))\n', filename: fixture('consumer'), settings: { julia: { entryFiles: [fixture('entry')] } } },
    'f(xs)=count(isodd,xs)',
    'f(xs)=length(findall(xs))',
    'f(xs)=length(findall(r"λ",xs))',
    'f(predicate,xs)=length(findall(predicate,xs))',
    'f(length,xs)=length(findall(isodd,xs))',
    'f(findall,xs)=length(findall(isodd,xs))',
    'f(isodd,xs)=length(findall(isodd,xs))',
    'f(xs)=length(findall(isodd,xs; option=true))',
    'f(xs)=length(findall(isodd,xs...))',
    '@m length(findall(isodd,xs))',
    'quote length(findall(isodd,xs)) end',
  ],
  invalid: [
    invalid('f(xs)=length(findall(isodd,xs))', 'f(xs)=Base.count(isodd, xs)'),
    invalid('f(α)=length(findall(x -> x > 0,α))', 'f(α)=Base.count(x -> x > 0, α)'),
    invalid('f(xs)=Base.length(Base.findall(Base.ismissing,xs))', 'f(xs)=Base.count(Base.ismissing, xs)'),
    { code: 'f(xs)=length(findall(isodd, # retain\n xs))', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
    { code: 'f(Base,xs)=length(findall(isodd,xs))', errors: [{ messageId: 'diagnostic', suggestions: [] }] },
  ],
});
