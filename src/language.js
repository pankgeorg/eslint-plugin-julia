import { parseJulia } from './parser/syntax-tree.js';
import { ParserTrapError } from './parser/wasm-host.js';
import { JuliaSourceCode } from './source-code.js';

export function createJuliaLanguage(parse = parseJulia) {
  return {
    fileType: 'text',
    lineStart: 1,
    columnStart: 0,
    nodeTypeKey: 'type',
    visitorKeys: { JuliaFile: ['children'] },
    defaultLanguageOptions: { recover: false },
    validateLanguageOptions(options) {
      for (const [key, value] of Object.entries(options)) {
        if (key !== 'recover') throw new TypeError(`Unknown Julia language option: ${key}`);
        if (typeof value !== 'boolean')
          throw new TypeError('Julia language option recover must be boolean');
      }
    },
    parse(file, { languageOptions = {} } = {}) {
      let result;
      try {
        result = parse(file.body);
      } catch (error) {
        if (!(error instanceof ParserTrapError)) throw error;
        return { ok: false, errors: [{ message: error.message, line: 1, column: 1 }] };
      }
      // ESLint's FileError columns are 1-based (unlike AST loc columns).
      const errors = result.diagnostics
        .filter((d) => d.level === 1)
        .map((d) => ({
          message: d.message,
          line: d.loc.start.line,
          column: d.loc.start.column + 1,
          endLine: d.loc.end.line,
          endColumn: d.loc.end.column + 1,
        }));
      if (errors.length && !languageOptions.recover) return { ok: false, errors };
      return { ok: true, ...result };
    },
    createSourceCode(file, result) {
      return new JuliaSourceCode(file.body, result);
    },
  };
}
export const language = createJuliaLanguage();
