// Direct runner: avoids node --test child pipe issues in restricted environments.
import './rules/prototype.test.js';
import './rules/first-rules.test.js';
import './parser/parser.test.js';
import './integration/eslint.test.js';

import './rules/no-duplicate-logical-operands.test.js';
