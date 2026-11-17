import {
  TextSourceCodeBase,
  VisitNodeStep,
  ConfigCommentParser,
  Directive,
} from '@eslint/plugin-kit';

const commentParser = new ConfigCommentParser();
const inlinePattern = /^\s*eslint(?:-enable|-disable(?:(?:-next)?-line)?)?(?:\s|$)/u;
export class JuliaSourceCode extends TextSourceCodeBase {
  #parents;
  #withComments;
  constructor(text, result) {
    super({ text, ast: result.ast, lineEndingPattern: /\r\n|[\r\n]/u });
    const { parents, ...properties } = result;
    Object.assign(this, properties);
    this.#parents = parents;
    this.#withComments = [...this.tokens, ...this.comments].sort((a, b) => a.range[0] - b.range[0]);
  }
  getParent(node) {
    return this.#parents.get(node);
  }
  // Strictly before/after the node's half-open range. Zero-width nodes use
  // the same boundary: a token ending/starting there qualifies.
  getTokenBefore(node, { includeComments = false } = {}) {
    const list = includeComments ? this.#withComments : this.tokens;
    let lo = 0,
      hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (list[mid].range[1] <= node.range[0]) lo = mid + 1;
      else hi = mid;
    }
    return list[lo - 1] ?? null;
  }
  getTokenAfter(node, { includeComments = false } = {}) {
    const list = includeComments ? this.#withComments : this.tokens;
    let lo = 0,
      hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (list[mid].range[0] < node.range[1]) lo = mid + 1;
      else hi = mid;
    }
    return list[lo] ?? null;
  }
  *traverse() {
    const pending = [[this.ast, 1]];
    while (pending.length) {
      const [node, phase] = pending.pop();
      yield new VisitNodeStep({ target: node, phase, args: [node, this.getParent(node)] });
      if (phase === 1) {
        pending.push([node, 2]);
        for (let i = node.children.length - 1; i >= 0; i--) pending.push([node.children[i], 1]);
      }
    }
  }
  commentValue(comment) {
    return comment.value.startsWith('#=') ? comment.value.slice(2, -2) : comment.value.slice(1);
  }
  getInlineConfigNodes() {
    return this.comments.filter((c) => inlinePattern.test(this.commentValue(c)));
  }
  getDisableDirectives() {
    const problems = [],
      directives = [];
    for (const node of this.getInlineConfigNodes()) {
      const { label, value, justification } = commentParser.parseDirective(this.commentValue(node));
      if (label === 'eslint-disable-line' && node.loc.start.line !== node.loc.end.line) {
        problems.push({
          ruleId: null,
          message: `${label} comment should not span multiple lines.`,
          loc: node.loc,
        });
      } else if (
        [
          'eslint-disable',
          'eslint-enable',
          'eslint-disable-line',
          'eslint-disable-next-line',
        ].includes(label)
      ) {
        directives.push(new Directive({ type: label.slice(7), node, value, justification }));
      }
    }
    return { problems, directives };
  }
  applyInlineConfig() {
    const problems = [],
      configs = [];
    for (const node of this.getInlineConfigNodes()) {
      const { label, value } = commentParser.parseDirective(this.commentValue(node));
      if (label !== 'eslint') continue;
      const parsed = commentParser.parseJSONLikeConfig(value);
      if (parsed.ok) configs.push({ config: { rules: parsed.config }, loc: node.loc });
      else problems.push({ ruleId: null, message: parsed.error.message, loc: node.loc });
    }
    return { problems, configs };
  }
}
