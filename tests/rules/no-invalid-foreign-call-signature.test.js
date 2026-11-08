import { tester, plugin } from '../helpers.js';
tester.run('no-invalid-foreign-call-signature', plugin.rules['no-invalid-foreign-call-signature'], {
  valid: [
    'ccall(:abs,Cint,(Cint,),x)',
    'ccall(:f,Cvoid,())',
    'ccall(:f,Cvoid,(Cint,Cint...),x,y)',
    'ccall(:f,Cvoid,(Cint,),xs...)',
    'f(ccall)=ccall(:f,Cint,(Cint,))',
    'Base.@ccall abs(x::Cint)::Cint',
    '@ccall getpid()::Cint',
    '@m Base.@ccall abs(x)::Cint',
    'quote ccall(:f,Cint,(Cint,)); end',
    'module M; macro ccall(x); x; end; @ccall abs(x)::Cint; end',
  ],
  invalid: [
    {
      code: 'ccall(:abs,Cint,(Cint,))',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: 'ccall(:abs,Cint,(Cint,),x,y)',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: 'Base.@ccall abs(α)::Cint',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
    {
      code: '@ccall abs(x)::Cint',
      errors: [
        {
          messageId: 'issue',
        },
      ],
    },
  ],
});
