import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JuliaSourceCode } from '../../src/source-code.js';
import { parseJulia } from '../../src/parser/syntax-tree.js';
import { positions } from '../../src/parser/positions.js';
test('UTF-8 to UTF-16 boundaries, astral code point, CRLF and SourceCode conversions', () => {
  const text = 'α = √2; 🐱 = 1';
  const result = parseJulia(text);
  assert.equal(result.bytes, 19);
  assert.equal(text.length, 14);
  const expected = [['α', [0,2], [0,1]], ['√', [5,8], [4,5]], ['🐱', [11,15], [8,10]], ['1', [18,19], [13,14]]];
  for (const [value, bytes, range] of expected) {
    const n = result.tokens.find(n => n.value === value);
    assert.deepEqual(n.byteRange, bytes);
    assert.deepEqual(n.range, range);
    assert.deepEqual(n.loc.start, { line: 1, column: range[0] });
  }
  const multiline = 'α\r\n🐱\rx\ny';
  const sc = new JuliaSourceCode(multiline, parseJulia(multiline));
  for (let i = 0; i <= multiline.length; i++) assert.equal(sc.getIndexFromLoc(sc.getLocFromIndex(i)), i);
  assert.deepEqual(sc.getLocFromIndex(3), { line: 2, column: 0 });
  assert.equal(positions(text).at(14), 8); // inside the cat's UTF-8 sequence
});
test('all reference sources: tree coverage, byte-to-UTF16 ranges and raw postorder kinds', () => {
  const cases = JSON.parse(readFileSync(new URL('../fixtures/jlparse_reference.json', import.meta.url), 'utf8'));
  const flags = JSON.parse(readFileSync(new URL('../fixtures/native-flags.json', import.meta.url)));
  for (const [caseIndex, c] of cases.entries()) {
    const r = parseJulia(c.src, { debug: true });
    const indexToByte = new Map([[0, 0]]);
    let index = 0, byte = 0;
    for (const char of c.src) {
      index += char.length; byte += Buffer.byteLength(char); indexToByte.set(index, byte);
    }
    assert.equal(r.rawCount, c.out.length, c.name);
    r.greenNodes.forEach((n, i) => {
      const [kind, span, nodespan, cls] = c.out[i];
      assert.equal(n.kindId, kind);
      assert.equal(n.class, cls);
      assert.equal(n.flags, flags[caseIndex][i], `${c.name} flags ${i}`);
      assert.equal(n.kind, c.names[kind]);
      assert.equal(n.nodespan, nodespan);
      assert.equal(n.byteRange[1] - n.byteRange[0], span);
      if (!n.interior) assert.equal(n.originalKindId, nodespan);
      assert.equal(indexToByte.get(n.range[0]), n.byteRange[0]);
      assert.equal(indexToByte.get(n.range[1]), n.byteRange[1]);
    });
    assert.equal(r.diagnostics.length, c.diags.length);
    r.diagnostics.forEach((d, i) => {
      const expected = c.diags[i];
      assert.deepEqual([d.byteRange[0] + 1, d.byteRange[1], d.level, d.message], expected);
    });
  }
});
test('triple string TOMBSTONE widths, sentinel removal, trivia errors, flags and nested comments', () => {
  const r = parseJulia('s = """\n    α\n    🐱\n    """\nx == nothing', { debug: true });
  assert(r.greenNodes.some(n => n.kind === 'Whitespace' && n.value === '    '));
  assert(r.greenNodes.some(n => n.kind === 'TOMBSTONE'));
  assert.equal(r.ast.children.length, 1);
  assert(!r.tokens.some(n => n.kind === 'TOMBSTONE'));
  assert.equal(r.tokens.find(n => n.value === '==').range[0], r.ast.range[1] - 10);
  assert.equal(r.greenNodes.find(n => n.kind === 'string').flags & 256, 256);
  const bad = parseJulia('function f(\n', { debug: true });
  assert(bad.greenNodes.some(n => n.class & 4 && n.class & 2));
  const sc = new JuliaSourceCode('function f(\n', bad);
  assert([...sc.traverse()].some(s => s.target.class & 4 && s.target.class & 2));
  assert.equal(parseJulia('#= hi #= nested =# =#').comments.length, 1);
  assert.equal(parseJulia('mutable struct A\nend', { debug: true }).greenNodes.find(n => n.kind === 'struct' && n.interior).flags, 384);
});

test('nonzero leaf TOMBSTONE raw fixture advances offsets before filtering', async () => {
  const { buildSyntax } = await import('../../src/parser/syntax-tree.js');
  const raw = [
    { kind: 'TOMBSTONE', kindId: 750, span: 2, nodespan: 750, class: 0, flags: 0, originalKind: 'TOMBSTONE' },
    { kind: 'Identifier', kindId: 3, span: 1, nodespan: 3, class: 64, flags: 0, originalKind: 'Identifier' },
    { kind: 'toplevel', kindId: 727, span: 3, nodespan: 2, class: 1, flags: 128 },
  ];
  const result = buildSyntax('  x', { raw, bytes: 3, diagnostics: [] }, { debug: true });
  assert.equal(result.greenNodes[0].span, 2);
  assert.deepEqual(result.ast.children[0].children[0].range, [2, 3]);
  assert.deepEqual(result.tokens.map(t => t.value), ['x']);
});

test('tokens are AST leaves; trivia and comment parents, binary token boundaries', () => {
  const text = 'f(α,#= 🐱 =#x)';
  const result = parseJulia(text), source = new JuliaSourceCode(text, result);
  const leaves = [...source.traverse()].filter(s => s.phase === 1 && s.target.interior === false).map(s => s.target);
  for (const n of leaves) if (n.range[0] !== n.range[1]) assert(result.tokens.includes(n));
  for (const n of [...source.tokens, ...source.comments]) {
    const p = source.getParent(n);
    assert(p, n.value);
    assert(p.range[0] <= n.range[0] && p.range[1] >= n.range[1]);
  }
  const x = source.tokens.find(t => t.value === 'x');
  assert.equal(source.getTokenBefore(x).value, ',');
  assert.equal(source.getTokenBefore(x, { includeComments: true }), source.comments[0]);
  assert.equal(source.getTokenAfter(source.comments[0]), x);
  assert.equal(source.getTokenBefore({ range: [0, 0] }), null);
  assert.equal(source.getTokenAfter({ range: [text.length, text.length] }), null);
  const boundary = x.range[0];
  assert.equal(source.getTokenAfter({ range: [boundary, boundary] }), x);
  assert.equal(source.getTokenBefore({ range: [x.range[1], x.range[1]] }), x);
  assert.equal(source.getTokenAfter(source.tokens[0]).value, '(');
});

test('adapter invariants throw; traps produce fatal files and recreate the instance', async () => {
  const { createWasmHost, ParserTrapError } = await import('../../src/parser/wasm-host.js');
  const { placeGreen } = await import('../../src/parser/green-tree.js');
  const { createJuliaLanguage } = await import('../../src/language.js');
  const { buildSyntax } = await import('../../src/parser/syntax-tree.js');
  const module = new WebAssembly.Module(readFileSync(new URL('../../wasm/parser.wasm', import.meta.url)));
  let instances = 0;
  const host = createWasmHost(() => {
    instances++;
    return instances === 1 ? { exports: { src_resize() {}, src_set4() {}, parse_src() { throw new WebAssembly.RuntimeError('test trap'); } } }
      : new WebAssembly.Instance(module, {});
  });
  const language = createJuliaLanguage(text => buildSyntax(text, host(text)));
  const file = { body: 'x = 1' };
  const bad = language.parse(file, { languageOptions: { recover: true } });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0].message, /Wasm trap.*test trap/u);
  assert.equal(language.parse(file).ok, true);
  assert.equal(instances, 2);
  assert.throws(() => placeGreen([], 1), /covers/u);
  assert.throws(() => placeGreen([{ span: 1, nodespan: 5, class: 1 }], 1), /subtree/u);
  const bug = createJuliaLanguage(() => { throw new Error('adapter bug'); });
  assert.throws(() => bug.parse(file), /adapter bug/u);
  assert.throws(() => createWasmHost(() => { throw new TypeError('host bug'); })(''), /host bug/u);
  assert.throws(() => { throw new ParserTrapError(new WebAssembly.RuntimeError('test')); }, ParserTrapError);
});

test('options validate and direct parser trees survive later parses', async () => {
  const { language } = await import('../../src/language.js');
  assert.throws(() => language.validateLanguageOptions({ recover: 'yes' }), /boolean/u);
  assert.throws(() => language.validateLanguageOptions({ unknown: false }), /Unknown/u);
  language.validateLanguageOptions({ recover: true });
  const first = parseJulia('α = 1');
  const snapshot = JSON.stringify(first.ast);
  parseJulia('for i in 1:10; println(i); end');
  assert.equal(JSON.stringify(first.ast), snapshot);
  assert.equal(first.greenNodes, undefined);
});

test('coverage and containment: BOM, astral, combining marks, operators, raw strings, hostile input', () => {
  const sources = ['', '\ufeffα=1', 'e\u0301 = 2', 'α\r\n🐱\rx\ny', 'x ==₁ y', 'x ⊗ y',
    '"""\n  α\n  🐱\n  """', 'raw"a\\b"', '"$(x) and $y"', '#= one #= two =# =#',
    'x = )', 'function f(\n', '('.repeat(100) + 'x' + ')'.repeat(100), '\u0000', '"unterminated', '\ud800'];
  for (const text of sources) {
    const source = new JuliaSourceCode(text, parseJulia(text));
    for (const step of source.traverse()) {
      if (step.phase !== 1) continue;
      const n = step.target, p = source.getParent(n);
      if (p) assert(p.range[0] <= n.range[0] && p.range[1] >= n.range[1]);
      let end = n.range[0];
      for (const c of n.children) {
        assert(c.range[0] >= end, text);
        end = c.range[1];
      }
    }
  }
});

test('Rust semantic normal form: layout freedom, exact comments and intended operator delta', async () => {
  const { normalForm } = await import('./normal-form.js');
  assert.deepEqual(normalForm(parseJulia('a; b # hi')), normalForm(parseJulia('a\nb # hi')));
  assert.notDeepEqual(normalForm(parseJulia('f(x)')), normalForm(parseJulia('f(x,)')));
  assert.notDeepEqual(normalForm(parseJulia('a # first')), normalForm(parseJulia('a # second')));
  const before = normalForm(parseJulia('🐱 #= keep =# == nothing'));
  const after = normalForm(parseJulia('🐱 #= keep =# === nothing'));
  const stack = [...after.tree];
  let changed = 0;
  while (stack.length) {
    const n = stack.pop();
    if (n.text === '===') { n.text = '=='; changed++; }
    stack.push(...n.children);
  }
  assert.equal(changed, 1);
  assert.deepEqual(after, before);
});

test('kind-aware flags do not confuse mutable structs, short functions, and strings', async () => {
  const f = await import('../../src/parser/flags.js');
  const result = parseJulia('mutable struct S; x; end\nf(x)=x\ns="""hi"""\nx+y\n√x\nf(x,)');
  const source = new JuliaSourceCode('', result);
  const nodes = [...source.traverse()].filter(s => s.phase === 1).map(s => s.target);
  const struct = nodes.find(n => n.kind === 'struct' && n.interior);
  const short = nodes.find(n => n.kind === 'function' && n.interior);
  const string = nodes.find(n => n.kind === 'string' && n.interior);
  assert(f.isMutableStruct(struct));
  assert(!f.isMutableStruct(short));
  assert(f.isShortFunction(short));
  assert(!f.isShortFunction(struct));
  assert(f.isTripleString(string));
  assert(!f.isTripleString(short));
  const infix = nodes.find(f.isInfixCall);
  assert.equal(f.getOperatorToken(infix).value, '+');
  const prefix = nodes.find(f.isPrefixOperatorCall);
  assert.equal(f.getOperatorToken(prefix).value, '√');
  assert(nodes.some(f.hasTrailingComma));
  assert.equal(f.semanticChildren(struct), struct.children);
});

test('AST v1 shape keeps root and nested toplevel containers with exact leaf spellings', () => {
  const project = n => [n.type, n.interior ?? null, n.value ?? null, n.children.map(project)];
  assert.deepEqual(project(parseJulia('α; 🐱').ast), ['JuliaFile', null, null, [
    ['toplevel', true, null, [
      ['toplevel', true, null, [
        ['Identifier', false, 'α', []], ['Identifier', false, '🐱', []],
      ]],
    ]],
  ]]);
  assert.equal(parseJulia('x').ast.kindId, undefined);
});
