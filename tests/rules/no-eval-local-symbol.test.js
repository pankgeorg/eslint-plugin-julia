import { tester, plugin } from '../helpers.js';
tester.run("no-eval-local-symbol", plugin.rules["no-eval-local-symbol"], {
  "valid": [
    "f(x)=x",
    "x=10; f(x)=eval(:x)",
    "f(eval,x)=eval(:x)",
    "f(x)=Core.eval(Main,:x)",
    "f(x)=eval(:(x+1))",
    "@m f(x)=eval(:x)",
    "quote f(x)=eval(:x); end",
    "include(\"missing.jl\"); f(x)=eval(:x)",
    "using UnknownModule; f(x)=eval(:x)",
    "f(x)=eval(:Int)",
    "@eval x=1; f(x)=eval(:x)",
    "f(x)=Core.eval(@__MODULE__, :x); g()=eval(:(x=1))",
    "baremodule M; f(x)=Core.eval(M,:x); end",
    "Core.setglobal!(Main,:x,1); f(x)=eval(:x)",
    "Core.swapglobal!(Main,:x,1); f(x)=eval(:x)",
    "module M; macro __MODULE__(); :(Other); end; f(x)=Core.eval(@__MODULE__, :x); end",
    "module M; const x=10; f(x)=eval(:x); end"
  ],
  "invalid": [
    {
      "code": "f(x)=eval(:x)",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function f(); y=3; eval(:y); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function f(α); Core.eval(@__MODULE__, :α); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "module M; f(z)=eval(:z); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    }
  ]
});
