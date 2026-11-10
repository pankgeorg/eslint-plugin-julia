import { dirname, isAbsolute, resolve } from 'node:path';

// Preserve TOML verbatim except path values. Tokenizing keeps comments and strings opaque.
const tokens =
  /^[\t ]*\[\[?[^\r\n]*?\]\]?|#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'[^']*'|[\w-]+|[\t ]+|\r?\n|./gmu;
function string(token) {
  if (token.startsWith("'")) return token.slice(1, -1);
  return JSON.parse(
    token.replace(/\\U([\da-f]{8})/giu, (_, n) =>
      JSON.stringify(String.fromCodePoint(parseInt(n, 16))).slice(1, -1),
    ),
  );
}
function header(token) {
  return token
    .trim()
    .replace(/^\[\[?|\]\]?$/gu, '')
    .trim();
}
export function rewritePaths(text, file, manifest = false) {
  let sources = false;
  const parts = text.match(tokens) ?? [];
  for (let i = 0; i < parts.length; i++) {
    if (/^\s*\[.+\]$/u.test(parts[i]))
      sources = /^(?:sources|"sources"|'sources')(?:\s*\.|$)/u.test(header(parts[i]));
    if (!manifest && !sources) continue;
    if (!['path', '"path"', "'path'"].includes(parts[i])) continue;
    let j = i + 1;
    while (/^\s+$/u.test(parts[j] ?? '')) j++;
    if (parts[j++] !== '=') continue;
    while (/^\s+$/u.test(parts[j] ?? '')) j++;
    if (!/^["']/u.test(parts[j] ?? '')) continue;
    const value = string(parts[j]);
    if (!isAbsolute(value)) parts[j] = JSON.stringify(resolve(dirname(file), value));
    i = j;
  }
  return parts.join('');
}
export function manifestNames(text) {
  const names = new Map();
  let name;
  const parts = text.match(tokens) ?? [];
  for (let i = 0; i < parts.length; i++) {
    if (/^\s*\[.+\]$/u.test(parts[i])) {
      const table = header(parts[i]).replace(/^deps\./u, '');
      name = parts[i].trimStart().startsWith('[[')
        ? /^["']/u.test(table)
          ? string(table)
          : table
        : undefined;
    }
    if (!name || !['uuid', '"uuid"', "'uuid'"].includes(parts[i])) continue;
    let j = i + 1;
    while (/^\s+$/u.test(parts[j] ?? '')) j++;
    if (parts[j++] !== '=') continue;
    while (/^\s+$/u.test(parts[j] ?? '')) j++;
    if (/^["']/u.test(parts[j] ?? '')) names.set(string(parts[j]), name);
  }
  return names;
}
