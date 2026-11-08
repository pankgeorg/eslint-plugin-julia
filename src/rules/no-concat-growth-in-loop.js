import { rule, suggest } from './idiom-common.js';
import { growth } from './growth-common.js';
export default rule('Review repeated vcat/hcat of a growing local Array in a loop.', {}, (context, m, source) => {
  const check = node => { for (const recurrence of growth(node, 'array', m, source)) suggest(context, recurrence, 'Repeated concatenation can copy the growing Array prefix; consider sized block writes, one final concatenation or append! for compatible vectors.'); };
  return { for: check, while: check };
}, false);
