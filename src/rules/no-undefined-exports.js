import { defineRule } from './common.js';
import { isInsideMacro } from '../parser/flags.js';
import { getScopeManager } from '../scope.js';
export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Report export/public names with no definition in this module.' },
    schema: [
      {
        type: 'object',
        properties: {
          includes: { enum: ['skip', 'report'] },
          unknownModules: { enum: ['skip', 'report'] },
          globals: { type: 'array', items: { type: 'string' } },
          moduleExports: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: { missing: 'Exported name "{{name}}" is not defined in this module.' },
  },
  create(context) {
    return {
      JuliaFile() {
        const m = getScopeManager(context.sourceCode, context),
          o = context.options[0] ?? {},
          globals = new Set(o.globals);
        const dynamic = new Set(
          m.scopes.filter((s) =>
            m.moduleResolution.scopes
              .get(s)
              ?.some((model) => model.unresolvedIncludes || model.dynamicEvaluation),
          ),
        );
        for (const e of m.exports) {
          if (
            !e.name ||
            isInsideMacro(e.node, context.sourceCode) ||
            globals.has(e.name) ||
            m.lookup(e.name, e.scope)
          )
            continue;
          if (o.includes !== 'report' && dynamic.has(e.scope)) continue;
          if (e.scope.bareUsing.some((n) => o.moduleExports?.[n]?.includes(e.name))) continue;
          if (
            o.unknownModules !== 'report' &&
            e.scope.bareUsing.some(
              (n) => !['Base', 'Core'].includes(n) && !Object.hasOwn(o.moduleExports ?? {}, n),
            )
          )
            continue;
          context.report({ node: e.node, messageId: 'missing', data: { name: e.name } });
        }
      },
    };
  },
});
