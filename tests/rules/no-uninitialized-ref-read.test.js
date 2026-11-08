import { tester, plugin } from '../helpers.js';
tester.run("no-uninitialized-ref-read", plugin.rules["no-uninitialized-ref-read"], {
  "valid": [
    "Ref{Int}()[]",
    "Ref{String}(\"ready\")[]",
    "r=Ref{String}()",
    "function f(); r=Ref{String}(); r[]=\"ready\"; r[]; end",
    "f(Ref)=Ref{String}()[]",
    "f(String)=Ref{String}()[]",
    "@m Ref{String}()[]",
    "quote Ref{String}()[]; end",
    "Ref{String}()[] = \"ready\"",
    "Ref{String}()[1]",
    "Ref{Vector{Int}}()[]",
    "f(Any)=Ref{Any}()[]",
    "Core.Ref{Int}()[]",
    "Ref{String}()[]::String = \"ready\"",
    "(Ref{String}()[], x) = (\"ready\", 1)"
  ],
  "invalid": [
    {
      "code": "Ref{String}()[]",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "Ref{Any}()[]",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "α = Base.Ref{Function}()[]",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    }
  ]
});
