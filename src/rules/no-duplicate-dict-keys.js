import { check, ordinary, strip, call, binary, text } from './semantic-common.js';

// Decode a bounded subset of Julia strings. Unsupported byte escapes and triple
// strings are skipped rather than interpreted using JavaScript string semantics.
function key(node, source) {
  node = strip(node);
  if (node.kind === 'quote' && node.children.length === 1 && node.children[0].kind === 'Identifier')
    return ['Symbol', node.children[0].value];
  if (node.kind !== 'string' || node.children.some(c => c.kind !== 'String')) return null;
  const raw = text(source, node);
  if (!raw.startsWith('"') || raw.startsWith('"""')) return null;
  let value = '', body = raw.slice(1, -1);
  const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', a: '\x07', e: '\x1b', '\\': '\\', '"': '"', '$': '$' };
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') { value += body[i]; continue; }
    const c = body[++i];
    if (Object.hasOwn(simple, c)) { value += simple[c]; continue; }
    const pattern = c === 'u' ? /^[0-9a-fA-F]{1,4}/u : c === 'U' ? /^[0-9a-fA-F]{1,8}/u
      : c === 'x' ? /^[0-9a-fA-F]{1,2}/u : null;
    if (!pattern) return null;
    const match = body.slice(i + 1).match(pattern);
    if (!match) return null;
    const cp = parseInt(match[0], 16);
    if (cp > 0x10ffff || cp >= 0xd800 && cp <= 0xdfff || c === 'x' && cp > 127) return null;
    value += String.fromCodePoint(cp); i += match[0].length;
  }
  return ['String', value];
}
export default check('Report duplicate homogeneous literal keys in builtin Dict constructors.', (context, m, source) => ({ call(node) {
  if (!ordinary(node, source)) return;
  const args = call(node, 'Dict', m);
  if (!args?.length) return;
  const head = strip(node.children[0]);
  const keys = [];
  for (const arg of args) {
    const pair = binary(strip(arg));
    if (!pair || !m.isUnshadowedBuiltin(pair[1], '=>')) return;
    const k = key(pair[0], source);
    if (!k || keys.length && k[0] !== keys[0].key[0]) return;
    keys.push({ key: k, node: pair[0] });
  }
  if (head.kind === 'curly' && (head.children.length !== 3 || !m.isUnshadowedBuiltin(strip(head.children[1]), keys[0].key[0]))) return;
  const seen = new Set();
  for (const { key: [, value], node: at } of keys) {
    if (seen.has(value)) context.report({ node: at, messageId: 'diagnostic', data: { message: 'This literal dictionary key repeats an earlier key; the later value overwrites it.' } });
    seen.add(value);
  }
} }));
