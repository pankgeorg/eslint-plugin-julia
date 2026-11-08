import { tester, plugin } from '../helpers.js';
tester.run('no-unreachable', plugin.rules['no-unreachable'], {
  "valid": [
    "function f(flag); if flag; return 1; end; println(\"live\"); end",
    "function f(); g() = return 1; println(\"live\"); end",
    "function f(); throw(e); println(\"live\"); end",
    "function f(); error(\"bad\"); println(\"live\"); end",
    "function f(); @label done; return; @goto done; work(); end",
    "@m function f(); return; dead(); end",
    "quote function f(); return; dead(); end end",
    "function f(); return; function g(); end; end",
    "function f(); try return; finally cleanup(); end; work(); end",
    "function f(); for i in xs; break; end; work(); end"
  ],
  "invalid": [
    { code: "function f()\n    @assert true\n    return 1\n    x = 2\nend", errors: [{ messageId: "issue", line: 4 }] },
    {
      "code": "function f(); return 1; println(\"dead\"); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "for i in 1:3; break; println(i); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "for i in 1:3; continue; println(i); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function 🐱(); return; α(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); begin return; end; dead(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); return; function g(); end; dead(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); return; # comment\ndead(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); g() = begin return; dead(); end; alive(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); begin return; dead(); end; dead2(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    }
  ]
});
