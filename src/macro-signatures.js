// Macro signatures: how the scope pass treats a macro call's arguments without expanding it.
//
// A signature is `{ args?: Role[], rest?: Role, last?: Role, kw?: Role, scope?, form? }`:
// `args[i]` is the role of the i-th argument, `last` the role of the final one (when there
// are more arguments than `args`), `rest` the role of every other argument, and `kw` the
// role of the right-hand side of a top-level `name = value` argument (its `name` is a
// symbol). A string is shorthand for `{ rest: role }`. Roles:
//
// - `expr`:    ordinary code. Every name it reads must be defined; written assignments,
//              loops and functions define names as they would outside the macro.
// - `bind`:    a declaration. Names in head positions (`x`, `x = …`, `x::T`, `x(t)`,
//              `x[1:3]`, operands of a top-level comparison, the same inside a `begin`
//              block) are defined in `scope`; everything else is read.
// - `maybe`:   like `bind`, but a head-position name only becomes a binding when nothing
//              else defines it. The default for macros not in the table.
// - `quote`:   generated code: names are not read here and define nothing, except that
//              `$x` interpolations read `x`. Definitions written in it are kept (`@eval`).
// - `fields`:  `a::T` field lists: `a` is a symbol, `T` is read.
// - `pattern`: a MacroTools-style pattern: `x_`/`xs__`/`x_T` bind `x`/`xs`; other
//              names are symbols.
// - `symbol`:  a name that is not a variable (`@goto label`).
// - `skip`:    not analyzed.
// - `decorator`: a definition the macro re-emits at module scope, possibly wrapped in a
//              lambda (Markdown's `@breaking true -> function f(…) … end`).
//
// `scope` (for `bind`): `enclosing` (the enclosing function or module, the default) or
// `global` (the module). `inner` gives the arguments a scope of their own (`@testset`).
// `form` selects one of the handlers in scope.js for shapes a role list can't express:
// `kwdef` (field defaults may read earlier fields), `ccall` (the callee is a symbol),
// `deprecate` (the old signature defines a global, the new one reads only its callee),
// `inject: [names]` lists names the macro defines around its arguments.
// `placeholders: true` makes the arguments of a bound call head (`f(t)`) symbols, not reads.
// `binding: 'assignment'` makes `bind` names ordinary assignments in the current scope
// (`@gensym x`, Pluto's `@bind x widget`) instead of macro bindings. A `kw` role applies
// from the second argument on. Forms: `signature` (`@register_symbolic f(x::Real)` defines the global `f`; its
// arguments are parameter names), `doc` (a documented signature is not code), `eval` (`@eval [module] code`: the code is
// `quote`d).

const EXPR = { rest: 'expr', kw: 'expr' };
const CODE = { rest: 'expr' };
const BIND = { rest: 'bind' };

export const ROLES = new Set([
  'expr',
  'bind',
  'maybe',
  'quote',
  'fields',
  'pattern',
  'symbol',
  'skip',
  'decorator',
]);
export const UNKNOWN = Object.freeze({ rest: 'maybe' });

const table = {
  // Logging, tests and benchmarks: operands are values; `key = value` after the first
  // argument is a keyword (`@info "msg" x=1`, `@test a ≈ b atol=0.1`, `setup=(…)`).
  ...Object.fromEntries(
    [
      '@info',
      '@warn',
      '@error',
      '@debug',
      '@logmsg',
      '@test',
      '@test_broken',
      '@test_skip',
      '@test_throws',
      '@test_logs',
      '@test_warn',
      '@test_nowarn',
      '@test_deprecated',
      '@btime',
      '@benchmark',
      '@belapsed',
      '@ballocated',
    ].map((m) => [m, EXPR]),
  ),
  // Assertions, timing, introspection: operands are ordinary code (`@time x = f()` assigns).
  ...Object.fromEntries(
    [
      '@assert',
      '@show',
      '@showtime',
      '@inferred',
      '@time',
      '@timev',
      '@timed',
      '@elapsed',
      '@allocated',
      '@allocations',
      '@printf',
      '@sprintf',
      '@code_warntype',
      '@code_typed',
      '@code_lowered',
      '@code_llvm',
      '@code_native',
      '@which',
      '@edit',
      '@less',
      '@functionloc',
      '@macroexpand',
      '@macroexpand1',
      '@invoke',
      '@invokelatest',
      '@cfunction',
      '@timeit',
      '@profile',
      '@fetch',
      '@fetchfrom',
      '@spawnat',
      '@something',
      '@lock',
      '@lock_nofail',
      '@preserve',
    ].map((m) => [m, CODE]),
  ),
  // Pass-through: the argument is ordinary code.
  ...Object.fromEntries(
    [
      '@inbounds',
      '@boundscheck',
      '@views',
      '@view',
      '@inline',
      '@noinline',
      '@propagate_inbounds',
      '@simd',
      '@threads',
      '@spawn',
      '@async',
      '@sync',
      '@static',
      '@fastmath',
      '@__dot__',
      '@atomic',
      '@atomicswap',
      '@atomicreplace',
      '@atomiconce',
      '@nospecialize',
      '@specialize',
      '@generated',
      '@assume_effects',
      '@constprop',
      '@noinfer',
      '@nospecializeinfer',
      '@task',
      '@distributed',
      '@everywhere',
      '@reexport',
      '@compat',
      '@pure',
      '@series',
      '@muladd',
      '@pack!',
      '@__doc__',
    ].map((m) => [m, CODE]),
  ),
  '@testset': { ...EXPR, scope: 'inner' },
  '@eval': { form: 'eval' },
  '@goto': { rest: 'symbol' },
  '@label': { rest: 'symbol' },
  '@NamedTuple': { rest: 'fields' },
  '@Kwargs': { rest: 'fields' },
  '@enum': { rest: 'bind', scope: 'global' },
  '@cenum': { rest: 'bind', scope: 'global' },
  '@gensym': { rest: 'bind', binding: 'assignment' },
  '@bind': { args: ['bind', 'expr'], scope: 'global', binding: 'assignment' },
  '@deprecate_binding': { args: ['bind', 'expr'], scope: 'global' },
  '@deprecate': { form: 'deprecate' },
  '@doc': { form: 'doc' },
  '@kwdef': { form: 'kwdef' },
  '@with_kw': { form: 'kwdef' },
  '@with_kw_noshow': { form: 'kwdef' },
  '@ccall': { form: 'ccall' },
  // A method signature, not code (ChainRulesCore, Symbolics).
  '@non_differentiable': { form: 'doc' },
  '@scalar_rule': { rest: 'skip' },
  '@register_symbolic': { form: 'signature' },
  '@register_array_symbolic': { form: 'signature' },
  '@register_derivative': { rest: 'skip' },
  // Destructuring and symbolic declarations.
  '@unpack': BIND,
  '@variables': BIND,
  '@parameters': BIND,
  '@constants': BIND,
  // `@syms f(t)`: `t` names an argument of the symbolic function, it isn't read.
  '@syms': { rest: 'bind', placeholders: true },
  '@brownian': BIND,
  '@independent_variables': BIND,
  '@named': BIND,
  '@mtkbuild': BIND,
  '@mtkcompile': BIND,
  '@capture': { args: ['expr', 'pattern'] },
  // RecipesBase: a recipe's body reads the `plotattributes` it is given.
  '@recipe': { rest: 'expr', inject: ['plotattributes'] },
  // Index notation (TensorOperations, Tullio, Einsum, TensorCast): indices are bound by
  // the macro.
  '@tensor': { rest: 'skip' },
  '@tensoropt': { rest: 'skip' },
  '@tullio': { rest: 'skip' },
  '@einsum': { rest: 'skip' },
  '@cast': { rest: 'skip' },
  '@reduce': { rest: 'skip' },
  '@matmul': { rest: 'skip' },
  // Markdown's parser registration: the function is defined at module scope.
  '@breaking': { rest: 'decorator' },
  '@trigger': { rest: 'decorator' },
  // Base.Cartesian generates `i_1`, `i_2`, … from its arguments.
  ...Object.fromEntries(
    [
      '@nloops',
      '@nref',
      '@ncall',
      '@ncallkw',
      '@nexprs',
      '@ntuple',
      '@nall',
      '@nany',
      '@nif',
      '@nextract',
    ].map((m) => [m, { rest: 'skip' }]),
  ),
};
// `@isdefined x` asks whether `x` exists: it never reads it.
table['@isdefined'] = { rest: 'skip' };

const normalize = (spec) => (typeof spec === 'string' ? { rest: spec } : spec);
const cache = new WeakMap();

/** The signature of `name` (`@info`), with user signatures (`settings.julia.macros`) first. */
export function macroSignature(name, user) {
  if (user && typeof user === 'object') {
    let merged = cache.get(user);
    if (!merged) {
      merged = new Map();
      for (const [k, v] of Object.entries(user)) {
        const spec = normalize(v);
        if (spec && typeof spec === 'object') merged.set(k.startsWith('@') ? k : `@${k}`, spec);
      }
      cache.set(user, merged);
    }
    if (merged.has(name)) return merged.get(name);
  }
  return Object.hasOwn(table, name) ? table[name] : UNKNOWN;
}

/** The role of argument `index` of `count` under `spec`. */
export function roleOf(spec, index, count) {
  const role =
    spec.args?.[index] ??
    (spec.last && index === count - 1 && index >= (spec.args?.length ?? 0) ? spec.last : null) ??
    spec.rest ??
    'expr';
  return ROLES.has(role) ? role : 'expr';
}

export const builtinMacroSignatures = table;
