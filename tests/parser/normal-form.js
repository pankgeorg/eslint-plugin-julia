// Port of jlparse.rs::sem_tree (coordinate-free). Error leaves and containers
// already survive syntax filtering; TOMBSTONE leaves and trivia have been removed.
export function normalForm(result) {
  const sem = new Map(),
    pending = [[result.ast, false]];
  while (pending.length) {
    const [node, exit] = pending.pop();
    if (!exit) {
      pending.push([node, true]);
      for (const child of node.children) pending.push([child, false]);
      continue;
    }
    const children = node.children.flatMap((c) => {
      const value = sem.get(c);
      return node.kind === 'toplevel' && c.kind === 'toplevel' ? value.children : [value];
    });
    let flags = (node.flags ?? 0) & ~(1 | 128);
    if (node.kind === 'toplevel') flags &= ~256;
    sem.set(node, {
      kind: !node.interior && node.class & (16 | 64) ? 65535 : node.kindId,
      flags,
      text: node.value ?? null,
      children,
    });
  }
  return {
    tree: sem.get(result.ast).children,
    comments: result.comments.map((c) => c.value.trimEnd()),
  };
}
