import { defineRule, isBareName } from './common.js';
import { isQuoted } from '../parser/flags.js';
import { parseJulia } from '../parser/syntax-tree.js';

// Use Julia's lexer for identifier boundaries (including Unicode), and for balanced
// delimiters in a possible property/index/call suffix. Never guess expression ends
// with a JavaScript identifier regexp.
function balanced(tokens, index) {
  const closers = { '(': ')', '[': ']', '{': '}' }, stack = [];
  for (let i = index; i < tokens.length; i++) {
    const t = tokens[i];
    if (closers[t.kind]) stack.push(closers[t.kind]);
    else if ([')', ']', '}'].includes(t.kind)) {
      if (stack.pop() !== t.kind) return null;
      if (!stack.length) return t.range[1];
    }
  }
  return null;
}
function continuation(name, suffix) {
  const text = name + suffix, tokens = parseJulia(text).tokens;
  let end = name.length;
  for (let i = 1; i < tokens.length;) {
    const t = tokens[i];
    if (t.range[0] !== end) break;
    if (t.kind === '.' && ['Identifier', 'StrMacroName'].includes(tokens[i + 1]?.kind)
      && tokens[i + 1].range[0] === t.range[1]) {
      end = tokens[i + 1].range[1]; i += 2;
    } else if (['[', '('].includes(t.kind)) {
      const close = balanced(tokens, i);
      if (close === null) break;
      end = close;
      while (i < tokens.length && tokens[i].range[0] < end) i++;
    } else break;
  }
  if (end === name.length) return null;
  const expression = text.slice(0, end), parsed = parseJulia(expression);
  return parsed.diagnostics.some(d => d.level === 1) ? null : expression;
}

export default defineRule({
  meta: {
    type: 'suggestion', docs: { description: 'Make bare string and command interpolation boundaries explicit.' },
    schema: [{ type: 'object', properties: { mode: { enum: ['always', 'ambiguous'] }, commands: { type: 'boolean' } }, additionalProperties: false }],
    defaultOptions: [{ mode: 'ambiguous', commands: true }], fixable: 'code', hasSuggestions: true,
    messages: {
      explicit: 'Parenthesize the interpolation of "{{name}}".',
      ambiguous: 'Only "{{name}}" is interpolated; the following text is literal. Make the intended boundary explicit.',
      preserve: 'Parenthesize only the identifier, preserving the literal suffix.',
      expression: 'Interpolate the whole expression "{{expression}}" (changes the value).',
    },
  },
  create(context) {
    const source = context.sourceCode, { mode = 'ambiguous', commands = true } = context.options[0] ?? {};
    function report(node, start, name, suffix) {
      const ambiguous = /^(?:\.[^\s.]|\[|\()/u.test(suffix);
      const expression = ambiguous ? continuation(name, suffix) : null;
      if (mode === 'ambiguous' && !expression) return;
      const range = [start, start + name.length];
      const preserve = fixer => fixer.replaceTextRange(range, `(${name})`);
      context.report({ node, loc: { start: source.getLocFromIndex(start - 1), end: source.getLocFromIndex(range[1]) },
        messageId: mode === 'always' ? 'explicit' : 'ambiguous', data: { name },
        ...(mode === 'always' ? { fix: preserve } : { suggest: [
          { messageId: 'preserve', fix: preserve },
          { messageId: 'expression', data: { expression }, fix: fixer => fixer.replaceTextRange([start, start + expression.length], `(${expression})`) },
        ] }),
      });
    }
    function string(node) {
      if (isQuoted(node, source)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (!isBareName(child) || source.text[child.range[0] - 1] !== '$') continue;
        const next = node.children[i + 1];
        report(child, child.range[0], source.getText(child), next?.kind === 'String' ? source.getText(next) : '');
      }
    }
    function cmdstring(node) {
      if (!commands || isQuoted(node, source)) return;
      // All nonstandard command macros own their interpolation semantics.
      const parent = source.getParent(node);
      if (parent?.kind === 'macrocall' && parent.children[0]?.kind !== 'macro_name'
        && parent.children[0]?.children.at(-1)?.kind !== 'macro_name') return;
      const token = node.children[0];
      if (token?.kind !== 'CmdString') return;
      const text = source.getText(token);
      let single = false, double = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '\\' && !single) {
          if (!double || ['"', '$', '\\', '\n', '\r'].includes(text[i + 1])) i++;
        } else if (c === "'" && !double) single = !single;
        else if (c === '"' && !single) double = !double;
        else if (c === '$' && !single) {
          const tail = text.slice(i + 1), tokens = parseJulia(tail).tokens, first = tokens[0];
          if (first?.range[0] !== 0) return;
          if (first.kind === '(') {
            const end = balanced(tokens, 0);
            if (end === null) return;
            i += end;
          } else {
            // A synthetic string supplies interpolation lexing context: in the
            // command tail, the closing shell quote otherwise looks like the
            // start of a Julia string macro (name"...).
            const atom = parseJulia('"$' + tail.split(/["\r\n]/u)[0] + '"').tokens.find(t => t.range[0] === 2);
            if (!isBareName(atom) || atom.range[0] !== 2) return;
            const name = tail.slice(0, atom.range[1] - 2);
            report(node, token.range[0] + i + 1, name, tail.slice(name.length));
            i += name.length;
          }
        }
      }
    }
    return { string, cmdstring };
  },
});
