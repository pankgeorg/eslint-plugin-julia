import { tester, plugin } from '../helpers.js';
tester.run("no-isdefined-local-call", plugin.rules["no-isdefined-local-call"], {
  "valid": [
    "isdefined(Main,:x)",
    "f(x)=@isdefined(x)",
    "f(isdefined,x)=isdefined(:x)",
    "f()=isdefined(:unknown)",
    "x=1; isdefined(:x)",
    "@m f(x)=isdefined(:x)",
    "quote f(x)=isdefined(:x); end",
    "f()=isdefined(:Int)",
    "f(x)=isdefined(x)",
    "f(x)=:(isdefined(:x))",
    "f()=isdefined(:x); x=1"
  ],
  "invalid": [
    {
      "code": "f(x)=isdefined(:x)",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function f(); local x; isdefined(:x); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "f(α)=Core.isdefined(:α)",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function f(flag); if flag; x=1; end; isdefined(:x); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    }
  ]
});
