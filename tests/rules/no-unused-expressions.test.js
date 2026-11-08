import { tester, plugin } from '../helpers.js';
tester.run('no-unused-expressions', plugin.rules['no-unused-expressions'], {
  "valid": [
    '### A Pluto.jl notebook ###\nlet; trigger; html"output"; end',
    '### A Pluto.jl notebook ###\r\nlet; (trigger); html"output"; end',
    '### A Pluto.jl notebook ###\nfunction f(x); x; return 1; end',
    { code: '### A Pluto.jl notebook ###\ntrigger; work()', options: [{ checkTopLevel: true }] },
    "function f(x)\n    x == 1\nend",
    "function f(x)\n    if x\n        a == b\n    else\n        c < d\n    end\nend",
    "function f(x); x; end",
    "function f(x); if x; 1; else; 2; end; end",
    "function f(); begin 42; end; end",
    "function f(); let x=1; x; end; end",
    "function f(); try 1; catch; 2; end; end",
    "function f(); nothing; return 1; end",
    "function f(); xs[1]; obj.x; return 1; end",
    "function f(); \"$(x)\"; return 1; end",
    "\"docs\"\nfunction f(); end",
    "function f(); \"docs\"\ng() = 1; end",
    "begin \"docs\"; x=1; end",
    "@m function f(); 42; return 1; end",
    "quote function f(); 42; return 1; end end",
    "42",
    "module M; x; end",
    "fig; work()",
    "module M; fig; work(); end",
    "function f(); \"internal documentation\"; return 1; end",
    "function f(); \"$(begin 42; x end)\"; return 1; end",
    "struct S; x; y; end",
    "struct S; begin x; y; end; end",
    "let x, y; work(); end",
    "function f(); g = x -> x; return 1; end"
  ],
  "invalid": [
    { code: 'let; trigger; html"output"; end', errors: [{ messageId: 'issue' }] },
    { code: '# ordinary file\n### A Pluto.jl notebook ###\nlet; trigger; work(); end', errors: [{ messageId: 'issue' }] },
    { code: '### A Pluto.jl notebook ### extra\nlet; trigger; work(); end', errors: [{ messageId: 'issue' }] },
    { code: '### A Pluto.jl notebook ###\nlet; x == y; work(); end', errors: [{ messageId: 'comparison' }] },
    { code: '### A Pluto.jl notebook ###\nfor i in xs; a < b < c; end', errors: [{ messageId: 'comparison' }] },
    { code: '### A Pluto.jl notebook ###\nx == y; work()', options: [{ checkTopLevel: true }], errors: [{ messageId: 'comparison' }] },
    { code: '### A Pluto.jl notebook ###\nfunction f(); 42; :unused; return 1; end', errors: [{ messageId: 'issue' }, { messageId: 'issue' }] },
    { code: "function f(); x == y; return 1; end", errors: [{ messageId: "comparison" }] },
    { code: "function f(x)\n    x == 1\n    return x\nend", errors: [{ messageId: "comparison", line: 2 }] },
    { code: "for i in 1:3\n    a[i] < 0\nend", errors: [{ messageId: "comparison", line: 2 }] },
    {
      "code": "function f(x); 42; return x; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(x); x; return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(x); :unused; return x; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function 🐱(α); α; return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); begin 42; end; return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); let x=1; x; end; return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); if a; 42; end; return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); try 42; catch; work(); end; return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "for x in xs; 42; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); try work(); finally 42; end; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); work(); \"unused\"; return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); (42); return 1; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "fig; work()",
      "options": [
        {
          "checkTopLevel": true
        }
      ],
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    }
  ]
});
