import { tester, plugin } from '../helpers.js';
const bad = (code, names, options) => ({
  code,
  ...(options ? { options: [options] } : {}),
  errors: names.map((name) => ({ messageId: 'undefined', data: { name } })),
});
tester.run('no-undef', plugin.rules['no-undef'], {
  valid: [
    {
      filename: fileURLToPath(
        new URL('../fixtures/packages/TestEntry/test/nested/leaf.jl', import.meta.url),
      ),
      code: 'm.package_helper(); test_helper(); child_helper(); year',
    },
    '@gensym result elapsed_ns; (result, elapsed_ns)',
    'function f(); Base.@gensym α β; (α, β); end',
    '@gensym(var"a b", 🐱); (var"a b", 🐱)',
    '@bind x 1; x',
    'PlutoUI.@bind α 1; α',
    'f(widget)=(@bind x widget; x); x',
    'let widget=1; @bind selected widget; end; selected',
    '@bind var"a b" 1; var"a b"',
    '@isdefined(x)',
    'f() = @isdefined(local_name)',
    'using Dates; year(now())',
    'import LinearAlgebra; norm([1, 2])',
    'module M; module Sub; export α; α=1; end; using .Sub; α; end',
    'ccall(:f, Int, ())',
    'f(A)=A[begin:end]',
    'const Alias{T}=Vector{T}',
    'macro m(); __module__; __source__; end',
    'f(@nospecialize x)=x',
    'f(x::T) where {Int<:T<:Real}=x',
    'using LinearAlgebra: norm; norm([1,2])',
    'function f(x); y=x+1; y; end',
    'using LinearAlgebra; norm([1,2])',
    'f()=(x; x=1)',
    'f(x)=(a=x; ()->a)',
    'f(x; kw=1)=x+kw',
    'f(x::T) where T=x',
    'struct X{T}; field::T; end',
    'f(x)=x.field',
    'f(x)=g(;key=x); g(;key)=key',
    'f(x)=(; key=x)',
    '@enum Shade light dark',
    // Macro signatures: declarations bind, generated code and symbols are not reads.
    'using LinearAlgebra; @enum Fruit apple pear; apple',
    '@enum Shade light dark; light',
    'f(s) = (@unpack a, b = s; a + b)',
    '@variables t x(t); x + t',
    'f() = (@variables a b; a * b)',
    'using JuMP; m = Model(); @variable(m, 0 <= x[i = 1:3] <= 1); @constraint(m, c, sum(x) <= 1); @objective(m, Min, x[1]); c',
    'f() = (@mydsl a b c; a + b + c)',
    'f() = (@mydsl y = 1; y)',
    'Normal() = 1; f(x) = (@mydsl x ~ Normal(); x)',
    'Base.@kwdef struct P; a::Int = 1; b::Int = a + 1; end',
    'for name in (:f, :g); @eval $name(x) = x; end',
    '@eval begin; generated_name; end',
    'const libc = "libc"; f(x) = @ccall libc.strlen(x::Cstring)::Csize_t',
    'f() = @ccall strlen("a"::Cstring)::Csize_t',
    'const NT = @NamedTuple{a::Int, b::Float64}',
    'f() = (@label top; @goto top)',
    '@deprecate old_api(x) new_api(x); new_api(x) = x; old_api(1)',
    '@doc "documented" g(x); g(y) = y',
    'f(ex) = (@capture(ex, h_(args__)) && (h, args))',
    'f(x) = (@info "value" x key=x; nothing)',
    '@recipe function f(x); seriestype --> :path; xguide := "x"; x; end',
    'quote x; end',
    'x=1; :($x)',
    'var"a b"=1; var"a b"',
    'module M; f()=M; end',
    {
      code: 'using M; foo()',
      options: [{ unknownModules: 'report', moduleExports: { M: ['foo'] } }],
    },
    { code: 'f()=project_name', options: [{ globals: ['project_name'] }] },
    { code: 'unknown()', options: [{ unknownGlobals: 'ignore' }] },
    // Names an unresolved `using` could export: calls, types, call arguments, top level.
    'using UnknownModule; f(x) = exported_fn(x)',
    'using UnknownModule; f(x::ExportedType) = x',
    'using UnknownModule; f(x) = g(x, exported_value)',
    'using UnknownModule; top_level_value + 1',
    'using UnknownModule; f(x) = x * im',
    'using UnknownModule; f(x) = x + Exported_Constant',
    'using UnknownModule; f(x) = (exported_fn(x); x + exported_fn)',
    'import ..unresolved_function; f() = unresolved_function()',
  ],
  invalid: [
    {
      filename: fileURLToPath(
        new URL('../fixtures/packages/TestEntry/test/nested/leaf.jl', import.meta.url),
      ),
      ...bad('m.package_helper(); missing_test_helper()', ['missing_test_helper']),
    },
    {
      filename: fileURLToPath(
        new URL('../fixtures/packages/TestEntry/test/orphan.jl', import.meta.url),
      ),
      ...bad('m; test_helper', ['m', 'test_helper']),
    },
    bad('f()=(@gensym x; x); x', ['x']),
    bad('@gensym x; y', ['y']),
    bad('@bind x 1; y', ['y']),
    bad('@bind x (() -> missing_widget())()', ['missing_widget']),
    bad('module A; @bind x 1; end; x', ['x']),
    bad('function f(x); x+offest; end', ['offest']),
    bad('f()=missing_helper(1)', ['missing_helper']),
    bad('module A; using UnknownModule; mystery; end; module B; typo; end', ['typo']),
    bad('module A; using Dates; end; module B; year; end', ['year']),
    bad('using UnknownModule; typo', ['typo'], { unknownModules: 'report' }),
    bad('using LinearAlgebra; norm([1,2]); typo()', ['typo'], { unknownModules: 'report' }),
    bad('f()=🐱', ['🐱']),
    bad('include("a.jl"); from_file()', ['from_file']),
    bad('eval(:(x=1)); x', ['x']),
    bad('baremodule M; sin(1); end', ['sin']),
    bad('x=1; module M; x; end', ['x']),
    bad('f(a=x,x=1)=a', ['x']),
    bad('f()=(let x=x; x; end)', ['x']),
    bad('f(;kw=missing_default)=kw', ['missing_default']),
    bad('struct X <: Unknown; field::MissingType; end', ['Unknown', 'MissingType']),
    bad('f(x::T) where T<:Unknown=x', ['Unknown']),
    bad('for x in x; x; end', ['x']),
    bad('f()=:(a+$b)', ['b']),
    bad('@inline f(x)=x+unknown', ['unknown']),
    bad('using M; bad()', ['bad'], { moduleExports: { M: ['good'] } }),
    // Macro operands are reads (Pkg.jl#4909: `$hex` in a logging message).
    bad('f(url) = Timer(2) do t; @info "downloading $url ($hex)"; end', ['hex']),
    bad('f() = @warn "x" value=missing_value', ['missing_value']),
    bad('f(x) = @test x ≈ expected', ['expected']),
    bad('f() = @show undefined_thing', ['undefined_thing']),
    bad('f(x) = @inbounds x[idx]', ['idx']),
    bad('f() = @mydsl g(typo_arg)', ['typo_arg']),
    bad('f() = @mydsl "$typo_interp"', ['typo_interp']),
    bad('@dsl [unknown for i in xs]', ['unknown', 'xs']),
    bad('@dsl for i in xs; unknown; end', ['xs', 'unknown']),
    bad('for n in (:a,); @eval f() = $missing_name; end', ['missing_name']),
    bad('Base.@kwdef struct Q; a::Int = later; later::Int = 1; b = nothing_here; end', [
      'nothing_here',
    ]),
    bad('f() = @ccall strlen(undefined_arg::Cstring)::Csize_t', ['undefined_arg']),
    {
      code: 'f() = (@thing ab; ab)',
      settings: { julia: { macros: { '@thing': 'expr' } } },
      errors: [
        { messageId: 'undefined', data: { name: 'ab' } },
        { messageId: 'undefined', data: { name: 'ab' } },
      ],
    },
    // An unresolved `using` only hides names it could plausibly export.
    {
      code: 'using UnknownModule; f(url) = Timer(2) do t; @info "downloading $url ($hex)"; end',
      errors: [{ messageId: 'unresolvedOnly', data: { name: 'hex', module: 'UnknownModule' } }],
    },
    {
      code: 'using UnknownModule; f(x) = x + offset_value',
      errors: [
        { messageId: 'unresolvedOnly', data: { name: 'offset_value', module: 'UnknownModule' } },
      ],
    },
    {
      code: 'using UnknownModule; f(x) = g(x, helper_value)',
      options: [{ unknownModules: 'values' }],
      errors: [{ messageId: 'unresolvedOnly' }],
    },
  ],
});

// Exercise ESLint's actual physicalFilename plumbing, rather than only the scope API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { engine } from '../helpers.js';
test('no-undef resolves sibling includes with real filePath and settings', async () => {
  const entry = fileURLToPath(new URL('../fixtures/packages/custom/entry.jl', import.meta.url));
  const child = fileURLToPath(new URL('../fixtures/packages/custom/child.jl', import.meta.url));
  const eslint = engine(
    { 'julia/no-undef': 'error' },
    {
      overrideConfig: [
        {
          files: ['**/*.jl'],
          plugins: { julia: plugin },
          language: 'julia/julia',
          settings: { julia: { entryFiles: [entry] } },
          rules: { 'julia/no-undef': 'error' },
        },
      ],
    },
  );
  const [result] = await eslint.lintText(readFileSync(child, 'utf8'), { filePath: child });
  assert.deepEqual(result.messages, []);
});
