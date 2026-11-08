import { parseJulia } from '../src/parser/syntax-tree.js';
for (const text of process.argv.slice(2)) {
  console.log(text);
  const result = parseJulia(text);
  const project = (n) => ({
    kind: n.kind,
    flags: n.flags,
    ...(n.value !== undefined && { value: n.value }),
    children: n.children.map(project),
  });
  console.log(JSON.stringify(project(result.ast), null, 2));
  console.log(result.diagnostics);
}
