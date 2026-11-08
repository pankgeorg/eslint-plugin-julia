import { tester, plugin } from '../helpers.js';
const rule = plugin.rules['prefer-parenthesized-interpolation'];
const ambiguous = (code, preserve, expression) => ({
  code,
  output: null,
  errors: [
    {
      messageId: 'ambiguous',
      suggestions: [
        { messageId: 'preserve', output: preserve },
        { messageId: 'expression', output: expression },
      ],
    },
  ],
});
const always = (code, output, count = 1) => ({
  code,
  options: [{ mode: 'always' }],
  output,
  errors: Array.from({ length: count }, () => ({ messageId: 'explicit', suggestions: [] })),
});
tester.run('prefer-parenthesized-interpolation', rule, {
  valid: [
    '"hello $name"',
    '"$(obj.field) $(a[1]) $(f(x))"',
    '"$(file).txt."',
    'raw"$obj.field"',
    'r"$obj.field"',
    'custom"$obj.field"',
    '"\\$obj.field"',
    ':("$obj.field"); quote; "$a[1]"; end',
    ':($obj.field)',
    "`echo '$obj.field'`",
    '`echo \\$obj.field`',
    '`echo $("$obj.field")`',
    { code: '`echo $obj.field`', options: [{ commands: false }] },
    { code: 'raw`echo $x`', options: [{ mode: 'always' }] },
    { code: '"$(name)"; raw"$x"; r"$x"; :("$x")', options: [{ mode: 'always' }] },
  ],
  invalid: [
    ambiguous('"$obj.field"', '"$(obj).field"', '"$(obj.field)"'),
    ambiguous('"$a[1]"', '"$(a)[1]"', '"$(a[1])"'),
    ambiguous('"$f(x)"', '"$(f)(x)"', '"$(f(x))"'),
    ambiguous('"$α.β[2]"', '"$(α).β[2]"', '"$(α.β[2])"'),
    ambiguous('"$file.jl"', '"$(file).jl"', '"$(file.jl)"'),
    ambiguous('`echo $obj.field`', '`echo $(obj).field`', '`echo $(obj.field)`'),
    ambiguous('`echo "$a[1]"`', '`echo "$(a)[1]"`', '`echo "$(a[1])"`'),
    ambiguous('@info "$obj.field"', '@info "$(obj).field"', '@info "$(obj.field)"'),
    always('"hi $name"', '"hi $(name)"'),
    always('"$α $🐱"', '"$(α) $(🐱)"', 2),
    always('"""$name.field"""', '"""$(name).field"""'),
    always('`echo $name`', '`echo $(name)`'),
    always('@info `echo $name`', '@info `echo $(name)`'),
    always('Base.@show `echo $name`', 'Base.@show `echo $(name)`'),
    always('`echo "$α" \'$literal\' \\$escaped`', '`echo "$(α)" \'$literal\' \\$escaped`'),
    always('"$x$x"', '"$(x)$(x)"', 2),
  ],
});
