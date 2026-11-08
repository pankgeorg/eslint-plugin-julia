import { rule, suggest } from './idiom-common.js';
import { growth } from './growth-common.js';
export default rule('Review repeated construction of a growing string prefix in a loop.', {}, (context, m, source) => {
  const check = node => { for (const recurrence of growth(node, 'string', m, source)) suggest(context, recurrence, 'Repeated string concatenation can copy the growing prefix; consider IOBuffer with print/write or join after reviewing semantics.'); };
  return { for: check, while: check };
}, false);
