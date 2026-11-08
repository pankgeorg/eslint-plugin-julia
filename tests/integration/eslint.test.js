import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engine, plugin } from '../helpers.js';
import { ESLint } from 'eslint';
const identity = { 'julia/prefer-identity-nothing': 'warn', 'julia/parse-errors': 'error' };
test('disable, enable, line, next-line, inline rules, block comments, unused and noInlineConfig', async () => {
  const checks = [
    ['# eslint-disable-next-line julia/prefer-identity-nothing -- deliberate\nx == nothing', 0, 1],
    ['x == nothing # eslint-disable-line julia/prefer-identity-nothing', 0, 1],
    ['# eslint-disable julia/prefer-identity-nothing\nx == nothing\n# eslint-enable julia/prefer-identity-nothing\ny != nothing', 1, 1],
    ['# eslint julia/prefer-identity-nothing: off\nx == nothing', 0, 0],
    ['#= eslint-disable-next-line julia/prefer-identity-nothing =#\nx == nothing', 0, 1],
    ['# eslint-disable-next-line julia/prefer-identity-nothing\nx === nothing', 1, 0],
    ['# eslint julia/prefer-identity-nothing: [', 1, 0],
    ['# eslint-disable made-up-rule\nx = 1', 1, 0],
    ['#= eslint-disable-line\n=#\nx == nothing', 2, 0],
  ];
  for (const [code, messages, suppressed] of checks) {
    const [r] = await engine(identity).lintText(code, { filePath: 'x.jl' });
    assert.equal(r.messages.length, messages, code);
    assert.equal(r.suppressedMessages.length, suppressed, code);
  }
  const [r] = await engine(identity, { allowInlineConfig: false }).lintText('# eslint-disable-next-line\nx == nothing', { filePath: 'x.jl' });
  assert(r.messages.some(m => m.ruleId === 'julia/prefer-identity-nothing'));
});
test('UTF-16 fixes, BOM, suggestion default, CRLF and idempotence through ESLint', async () => {
  const text = '\ufeffα = √2; 🐱 == nothing\r\nx != nothing';
  const [unfixed] = await engine(identity, { fix: true }).lintText(text, { filePath: 'x.jl' });
  assert.equal(unfixed.output, undefined);
  assert.equal(unfixed.messages[0].suggestions[0].fix.text, '===');
  const rules = { ...identity, 'julia/prefer-identity-nothing': ['warn', { fix: true }] };
  const [fixed] = await engine(rules, { fix: true }).lintText(text, { filePath: 'x.jl' });
  assert.equal(fixed.output, '\ufeffα = √2; 🐱 === nothing\r\nx !== nothing');
  const [again] = await engine(rules, { fix: true }).lintText(fixed.output, { filePath: 'x.jl' });
  assert.equal(again.output, undefined);
  const [excluded] = await engine(rules, { fix: true, fixTypes: ['problem'] }).lintText(text, { filePath: 'x.jl' });
  assert.equal(excluded.output, undefined);
});
test('fatal by default, recovery opt-in, all errors and no edits in recovery', async () => {
  const text = 'α = √2; 🐱 = )';
  const [fatal] = await engine(identity).lintText(text, { filePath: 'x.jl' });
  assert.equal(fatal.fatalErrorCount, 2);
  assert(fatal.messages.every(m => m.ruleId === null && m.fatal && m.column === 14));
  const [recover] = await engine(identity, {}, { recover: true }).lintText(text, { filePath: 'x.jl' });
  assert.equal(recover.fatalErrorCount, 0);
  assert(recover.messages.every(m => m.ruleId === 'julia/parse-errors' && m.column === 14));
  const [badFix] = await engine({ 'julia/prefer-identity-nothing': ['error', { fix: true }] }, { fix: true }, { recover: true })
    .lintText('x == nothing\n)', { filePath: 'x.jl' });
  assert.equal(badFix.output, undefined);
  assert(badFix.messages.every(m => !m.fix && !m.suggestions));
});
test('literal operator attribute selectors, structural selectors and leaf token identity', async () => {
  const seen = [];
  const selectors = { meta: { schema: [] }, create(context) { return {
    '[type="."]': n => seen.push(['dot', n.kind]),
    '[kind="="] > Identifier': n => seen.push(['assignment', n.value]),
    'call > Identifier[originalKind="+"]': n => {
      assert(context.sourceCode.tokens.includes(n));
      seen.push(['plus', n.value]);
    },
  }; } };
  const e = new ESLint({ overrideConfigFile: true, overrideConfig: [{ files: ['**/*.jl'],
    plugins: { julia: { ...plugin, rules: { selectors } } }, language: 'julia/julia', rules: { 'julia/selectors': 'error' } }] });
  await e.lintText('x = a.b + y', { filePath: 'x.jl' });
  assert.deepEqual(seen, [['assignment','x'], ['dot','.'], ['plus','+']]);
});
test('recommended config and mixed JS/Julia selection', async () => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [plugin.configs.recommended,
    { files: ['**/*.js'], rules: { 'no-debugger': 'error' } }] });
  const [jl] = await eslint.lintText('struct S; x; x; end', { filePath: 'x.jl' });
  assert.equal(jl.messages[0].ruleId, 'julia/no-duplicate-struct-fields');
  const [js] = await eslint.lintText('debugger;', { filePath: 'x.js' });
  assert.equal(js.messages[0].ruleId, 'no-debugger');
});

test('central recovered-file guard strips fixes/suggestions for any wrapped rule', async () => {
  const { defineRule } = await import('../../src/rules/common.js');
  let fixesCalled = 0;
  const guardProbe = defineRule({ meta: { schema: [], fixable: 'code', hasSuggestions: true, messages: { probe: 'Probe.' } },
    create(context) { return { JuliaFile(node) {
      const fix = fixer => { fixesCalled++; return fixer.insertTextAfterRange([0, 0], ' '); };
      context.report({ node, messageId: 'probe', fix, suggest: [{ messageId: 'probe', fix }] });
    } }; } });
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{ files: ['**/*.jl'],
    plugins: { julia: { ...plugin, rules: { probe: guardProbe } } }, language: 'julia/julia',
    languageOptions: { recover: true }, rules: { 'julia/probe': 'error' } }] });
  const [r] = await eslint.lintText('x = )', { filePath: 'x.jl' });
  assert.equal(r.messages.length, 1);
  assert(!r.messages[0].fix && !r.messages[0].suggestions);
  assert.equal(fixesCalled, 0);
});

test('all shipped rules operate on frozen AST, token, comment and diagnostic objects', async () => {
  const freeze = object => {
    const stack = [object], seen = new WeakSet();
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== 'object' || seen.has(n)) continue;
      seen.add(n);
      stack.push(...Object.values(n));
      Object.freeze(n);
    }
  };
  const mutationGuard = { meta: { schema: [] }, create(context) { return { JuliaFile(node) {
    freeze(node);
    for (const field of ['tokens', 'comments', 'diagnostics']) freeze(context.sourceCode[field]);
    assert.throws(() => { node.children.push(node); }, TypeError);
  } }; } };
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{ ...plugin.configs.all,
    plugins: { julia: plugin, test: { rules: { freeze: mutationGuard } } },
    rules: { 'test/freeze': 'error', ...plugin.configs.all.rules } }] });
  const [r] = await eslint.lintText('struct S; x; x; end\nf(a=1;a=2)\ntry f(); catch; end\nfor i in xs; for i in ys; end; end\nx == nothing', { filePath: 'x.jl' });
  assert.equal(r.messages.filter(m => ['julia/no-duplicate-struct-fields',
    'julia/no-duplicate-keyword-arguments', 'julia/no-empty-catch',
    'julia/no-shadowed-loop-var', 'julia/prefer-identity-nothing'].includes(m.ruleId)).length, 5);
  assert.ok(r.messages.every(m => !m.fatal));
});

test('CLI: discovery, ignores, overrides, stdin, fix, cache and worker config loading', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, openSync, closeSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const folder = mkdtempSync(fileURLToPath(new URL('../.tmp-cli-', import.meta.url)));
  const cli = fileURLToPath(new URL('../../node_modules/eslint/bin/eslint.js', import.meta.url));
  const pluginURL = new URL('../../src/index.js', import.meta.url).href;
  const run = (args, input) => {
    // This sandbox rejects child pipes; ordinary file descriptors work on all
    // supported platforms and keep CLI execution bounded by spawnSync's timeout.
    writeFileSync(join(folder, 'stdin.txt'), input ?? '');
    const fds = [openSync(join(folder, 'stdin.txt'), 'r'), openSync(join(folder, 'stdout.txt'), 'w'), openSync(join(folder, 'stderr.txt'), 'w')];
    let r;
    try { r = spawnSync(process.execPath, [cli, ...args], { cwd: folder, stdio: fds, timeout: 15000 }); }
    finally { fds.forEach(closeSync); }
    r.stdout = readFileSync(join(folder, 'stdout.txt'), 'utf8');
    r.stderr = readFileSync(join(folder, 'stderr.txt'), 'utf8');
    assert.ifError(r.error);
    assert.equal(r.signal, null, r.stderr);
    return r;
  };
  try {
    writeFileSync(join(folder, 'package.json'), '{"type":"module"}');
    writeFileSync(join(folder, 'eslint.config.js'), `import julia from ${JSON.stringify(pluginURL)};\nexport default [
      { ignores: ['ignored.jl', 'eslint.config.js'] }, julia.configs.recommended,
      { files: ['**/*.jl'], rules: { 'julia/prefer-identity-nothing': ['warn', {fix:true}] } },
      { files: ['sub/*.jl'], rules: { 'julia/no-duplicate-struct-fields': 'warn' } }
    ];\n`);
    writeFileSync(join(folder, 'ignored.jl'), ')');
    writeFileSync(join(folder, 'file with spaces.jl'), '🐱 == nothing\n');
    mkdirSync(join(folder, 'sub'));
    writeFileSync(join(folder, 'sub/point.jl'), 'struct S; x; x; end');
    const discover = run(['.', '--format', 'json']);
    assert.equal(discover.status, 0, discover.stderr);
    const results = JSON.parse(discover.stdout);
    assert.equal(results.length, 2);
    assert(results.every(r => r.messages.every(m => m.severity === 1)));
    const stdin = run(['--stdin', '--stdin-filename', 'α.jl', '--format', 'json'], '🐱 == nothing');
    assert.equal(stdin.status, 0, stdin.stderr);
    const suggestion = JSON.parse(stdin.stdout)[0].messages[0];
    assert.equal(suggestion.column, 4);
    assert.deepEqual(suggestion.suggestions[0].fix.range, [3, 5]);
    const fatal = run(['--stdin', '--stdin-filename', 'bad.jl', '--format', 'json'], 'α = )');
    assert.equal(fatal.status, 1);
    assert.equal(JSON.parse(fatal.stdout)[0].fatalErrorCount, 2);
    const fix = run(['file with spaces.jl', '--fix']);
    assert.equal(fix.status, 0, fix.stderr);
    assert.equal(readFileSync(join(folder, 'file with spaces.jl'), 'utf8'), '🐱 === nothing\n');
    for (let i = 0; i < 2; i++) {
      const cached = run(['.', '--cache', '--cache-strategy', 'content', '--format', 'json']);
      assert.equal(cached.status, 0, cached.stderr);
      assert.equal(JSON.parse(cached.stdout).length, 2);
    }
    // Change content without relying on timestamps; the cached warning disappears.
    writeFileSync(join(folder, 'sub/point.jl'), 'struct S; x; y; end');
    const invalidated = run(['.', '--cache', '--cache-strategy', 'content', '--format', 'json']);
    assert(JSON.parse(invalidated.stdout).every(r => r.messages.length === 0));
    const workers = run(['.', '--concurrency', '2', '--format', 'json']);
    assert.equal(workers.status, 0, workers.stderr);
    assert.equal(JSON.parse(workers.stdout).length, 2);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('SARIF formatter accepts Julia rule results with UTF-16 columns', async () => {
  const { fileURLToPath } = await import('node:url');
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [plugin.configs.recommended] });
  const results = await eslint.lintFiles([fileURLToPath(new URL('../fixtures/findings.jl', import.meta.url))]);
  const formatter = await eslint.loadFormatter('@microsoft/eslint-formatter-sarif');
  const sarif = JSON.parse(await formatter.format(results));
  assert.equal(sarif.version, '2.1.0');
  const findings = sarif.runs[0].results;
  assert.equal(findings.length, 3);
  assert(findings.some(r => r.ruleId === 'julia/no-shadowed-loop-var'));
  const keyword = findings.find(r => r.ruleId === 'julia/no-duplicate-keyword-arguments');
  assert.equal(keyword.locations[0].physicalLocation.region.startColumn, 8);
});
