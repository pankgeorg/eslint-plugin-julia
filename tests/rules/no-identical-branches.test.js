import { tester, plugin } from '../helpers.js';
tester.run('no-identical-branches', plugin.rules['no-identical-branches'], {
  "valid": [
    "if ready; start(); else stop(); end",
    "ready ? \"a b\" : \"ab\"",
    "if a; else; end",
    "if a; work(); end",
    "@m if a; work(); else work(); end",
    "quote if a; work(); else work(); end end",
    "a ? raw\"x\" : \"x\"",
    "a ? \"$(x)\" : \"x\""
  ],
  "invalid": [
    {
      "code": "if ready; start(); else start(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if x == 1; send(x); elseif x == 2; send(x); else reject(x); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "ready ? value : value",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if a; x(); elseif b; x(); else x(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if α; β(); else # comment\n β(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); 🐱 ? (α) : α; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if a; x(); else (x()); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "a ? \"a b\" : \"a b\"",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    }
  ]
});
