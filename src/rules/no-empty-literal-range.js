import { checkRule, ordinary, strip, smallInteger, report } from './correctness-common.js';
import { isInfixCall } from '../parser/flags.js';
export default checkRule(
  'Report literal ranges that cannot iterate toward their endpoint.',
  (context, m, source) => ({
    iteration(node) {
      if (!node.interior || !ordinary(node, source)) return;
      for (const clause of node.children) {
        const range = strip(clause.children[1]);
        if (!range || !isInfixCall(range) || ![3, 4].includes(range.children.length)) continue;
        const values = [range.children[0], ...range.children.slice(2)].map(smallInteger);
        if (values.some((v) => v === null)) continue;
        const [start, step, end] = values.length === 2 ? [values[0], 1, values[1]] : values;
        if (
          ((step > 0 && start > end) || (step < 0 && start < end)) &&
          m.isUnshadowedBuiltin(range.children[1], ':')
        )
          report(
            context,
            range,
            'This literal range is empty: its step points away from the endpoint.',
          );
      }
    },
  }),
);
