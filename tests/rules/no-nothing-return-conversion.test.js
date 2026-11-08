import { tester, plugin } from '../helpers.js';
tester.run("no-nothing-return-conversion", plugin.rules["no-nothing-return-conversion"], {
  "valid": [
    "function dimension(dom)::Int end",
    "function degree(dom)::Int; end",
    "function f()::Int; for i in 1:0:3; return nothing; end; end",
    "f()::Int = 1",
    "function f()::Int; for i in 1:1; return 1; end; end",
    "f(x)::Union{Nothing,Int}=nothing",
    "f()::Custom = nothing",
    "function f(ok)::Int; if ok; return 1; else; return 2; end; end",
    "function f(ok)::Int; if ok; return 1; else; error(\"bad\"); end; end",
    "function f(ok)::Int; if ok; return 1; end; 2; end",
    "function f()::Int; error(\"bad\"); return nothing; end",
    "function f()::Int; g()=nothing; return 1; end",
    "function f(Int); g()::Int=nothing; end",
    "@m f()::Int=nothing",
    "quote f()::Int=nothing; end",
    "function f()::Int; try; return nothing; finally; return 1; end; end",
    "function f()::Int; while true; end; end",
    "function f()::Int; if true; 1; end; end",
    "function f(nothing)::Int; return nothing; end",
    "function f()::Int; while false; return nothing; end; 1; end",
    "function f()::Int; for i in 1:0; return nothing; end; 1; end",
    "function f()::Int; while true; for i in 1:2; break; end; end; end"
  ],
  "invalid": [
    {
      "code": "function f(ok)::Int; if ok; return 1; end; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function f()::Float64; return nothing; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function f()::Bool; return; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "f(α)::String = nothing",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function f(xs)::Int64; for x in xs; use(x); end; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    }
  ]
});
