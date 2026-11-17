import {
  checkRule,
  ordinary,
  strip,
  nodes,
  statements,
  call,
  report,
  smallInteger,
  identifierName,
} from './correctness-common.js';
const types = ['Int', 'Int64', 'Float64', 'Bool', 'String'];
export default checkRule(
  'Report obvious nothing returns converted to incompatible builtin types.',
  (context, m, source) => ({
    function(node) {
      if (!node.interior || !ordinary(node, source)) return;
      let signature = strip(node.children[0]);
      while (signature?.kind === 'where') signature = strip(signature.children[0]);
      if (signature?.kind !== '::' || signature.children.length !== 2) return;
      const annotation = strip(signature.children[1]);
      const type = identifierName(annotation.kind === '.' ? annotation.children[1] : annotation);
      if (!types.includes(type) || !m.isUnshadowedBuiltin(annotation, type)) return;
      const body = node.children.at(-1),
        bad = new Set();
      // Empty annotated methods are commonly intentional interface placeholders.
      if (body.kind === 'block' && !statements(body).length) return;
      // Unmodeled exception handling or macro expansion could replace the result.
      function unsupported(n) {
        if (['function', '->', 'do', 'quote', 'inert'].includes(n.kind)) return false;
        return (
          ['try', 'macrocall', '&&', '||', '?'].includes(n.kind) || n.children.some(unsupported)
        );
      }
      if (unsupported(body)) return;
      function analyze(n, terminal) {
        n = strip(n);
        if (['break', 'continue'].includes(n.kind)) return false;
        if (n.kind === 'return') {
          if (!n.children.length || m.isUnshadowedBuiltin(strip(n.children[0]), 'nothing'))
            bad.add(n);
          return false;
        }
        if (['throw', 'error'].some((name) => call(n, name, m))) return false;
        if (['block', 'toplevel'].includes(n.kind)) {
          const parts = statements(n);
          if (!parts.length && terminal) bad.add(n);
          let reachable = true;
          for (let i = 0; reachable && i < parts.length; i++)
            reachable = analyze(parts[i], terminal && i === parts.length - 1);
          return reachable;
        }
        if (['if', 'elseif'].includes(n.kind)) {
          const [condition, yes, no] = n.children;
          const constant = strip(condition).kind === 'Bool' ? strip(condition).value : null;
          if (constant === 'true') return analyze(yes, terminal);
          if (constant === 'false') {
            if (no) return analyze(no, terminal);
            if (terminal) bad.add(n);
            return true;
          }
          const left = analyze(yes, terminal),
            right = no ? analyze(no, terminal) : true;
          if (!no && terminal) bad.add(n);
          return left || right;
        }
        if (['for', 'while'].includes(n.kind)) {
          // Inspect explicit returns without treating each iteration as a return value.
          let nonempty = false,
            empty =
              n.kind === 'while' &&
              strip(n.children[0]).kind === 'Bool' &&
              strip(n.children[0]).value === 'false';
          if (n.kind === 'for' && n.children[0]?.children.length === 1) {
            const range = strip(n.children[0].children[0].children[1]);
            if (
              range?.kind === 'call' &&
              [3, 4].includes(range.children.length) &&
              range.children[1].value === ':' &&
              m.isUnshadowedBuiltin(range.children[1], ':')
            ) {
              const values = [range.children[0], ...range.children.slice(2)].map(smallInteger);
              if (values.every((v) => v !== null)) {
                const [a, step, b] = values.length === 2 ? [values[0], 1, values[1]] : values;
                if (step === 0) return false; // Builtin range construction throws before the body runs.
                nonempty = (step > 0 && a <= b) || (step < 0 && a >= b);
                empty = (step > 0 && a > b) || (step < 0 && a < b);
              }
            }
          }
          if (empty) {
            if (terminal) bad.add(n);
            return true;
          }
          const bodyCompletes = analyze(n.children.at(-1), false);
          // A guaranteed nonempty loop that returns or throws cannot fall through.
          const exitsFunction =
            !bodyCompletes &&
            ![...nodes(n.children.at(-1))].some((c) => ['break', 'continue'].includes(c.kind));
          if (nonempty && exitsFunction) return false;
          function targetsBreak(part) {
            if (['for', 'while', 'function', '->', 'do', 'quote', 'inert'].includes(part.kind))
              return false;
            return part.kind === 'break' || part.children.some(targetsBreak);
          }
          const endless =
            n.kind === 'while' &&
            strip(n.children[0]).kind === 'Bool' &&
            strip(n.children[0]).value === 'true' &&
            !targetsBreak(n.children.at(-1));
          if (terminal && !endless) bad.add(n);
          return !endless;
        }
        if (['function', '->', 'do', 'quote', 'inert'].includes(n.kind)) return true;
        if (terminal && m.isUnshadowedBuiltin(n, 'nothing')) bad.add(n);
        return true;
      }
      analyze(body, true);
      for (const n of bad)
        report(
          context,
          n,
          'This return path produces nothing, which cannot convert to the annotated builtin return type.',
        );
    },
  }),
);
