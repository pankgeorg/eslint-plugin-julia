import { readWasm, manifest } from './wasm-host.js';
import { positions } from './positions.js';
import { placeGreen } from './green-tree.js';

export function buildSyntax(text, parsed, { debug = false } = {}) {
  const { nodes: raw, roots } = placeGreen(parsed.raw, parsed.bytes);
  const offsets = positions(text, parsed.bytes), parents = new WeakMap();
  const tokens = [], comments = [], nodes = [], keep = [], visitorKeys = Object.create(null);
  const location = range => ({ start: offsets.loc(range[0]), end: offsets.loc(range[1]) });
  for (const o of raw) {
    const range = [offsets.at(o.start), offsets.at(o.end)];
    const n = { type: o.kind, kind: o.kind, kindId: o.kindId, flags: o.flags, class: o.class,
      interior: o.interior, byteRange: [o.start, o.end], range, loc: location(range),
      children: o.children.map(i => nodes[i]).filter((_, j) => keep[o.children[j]]) };
    if (!o.interior) Object.assign(n, { value: text.slice(...range), originalKindId: o.nodespan, originalKind: o.originalKind });
    nodes.push(n);
    keep.push(o.interior || (o.kind !== 'TOMBSTONE' && (Boolean(o.class & 4) || !(o.class & (2 | 128)))));
    // Trivia tokens and comments own the same immediate interior parent as syntax.
    for (const i of o.children) parents.set(nodes[i], n);
    visitorKeys[n.kind] = ['children'];
    if (!o.interior && o.kind === 'Comment') comments.push(n);
    else if (!o.interior && o.kind !== 'TOMBSTONE' && !(o.class & 128) && range[1] > range[0]) tokens.push(n);
  }
  const ast = { type: 'JuliaFile', kind: 'JuliaFile', children: roots.filter(i => keep[i]).map(i => nodes[i]),
    range: [0, text.length], byteRange: [0, parsed.bytes], loc: location([0, text.length]) };
  for (const i of roots) parents.set(nodes[i], ast);
  visitorKeys.JuliaFile = ['children'];
  const diagnostics = parsed.diagnostics.map(d => {
    const start = offsets.at(d.first - 1), end = Math.max(start, offsets.at(d.last));
    const range = [start, end];
    return { message: d.message, level: d.level, byteRange: [d.first - 1, d.last], range, loc: location(range) };
  });
  const result = { ast, tokens, comments, diagnostics, visitorKeys, parents, provenance: manifest,
    rawCount: raw.length, bytes: parsed.bytes };
  // Only debug parses retain a second view with unfiltered raw children.
  if (debug) result.greenNodes = raw.map((o, i) => ({ ...nodes[i], span: o.span, nodespan: o.nodespan,
    children: o.children }));
  return result;
}
export function parseJulia(text, options) { return buildSyntax(text, readWasm(text), options); }
