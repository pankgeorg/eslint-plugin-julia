import { tester, plugin } from '../helpers.js';
tester.run('no-empty-block', plugin.rules['no-empty-block'], {
  "valid": [
    "if ready; nothing; end",
    "for x in items; # Deliberately exhaust the iterator.\nend",
    "function f end",
    "struct S; end",
    "module M; end",
    "begin end",
    "try work(); catch; end",
    "try work(); finally; end",
    "@m if ready; end",
    "quote for x in xs; end end",
    "let x=1; x; end",
    "function f(); nothing; end",
    {
      "code": "while ready; end",
      "options": [
        {
          "allowEmptyWhile": true
        }
      ]
    },
    {
      "code": "if ready; #= intentional =#\nend",
      "options": [
        {
          "allowComment": true
        }
      ]
    }
  ],
  "invalid": [
    {
      "code": "if ready; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "for x in items; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "while ready; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function f(); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "let; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if ready; begin end; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if ready; work(); elseif waiting; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if ready; work(); else; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "function 🐱(α); end",
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if ready; # deliberate\nend",
      "options": [
        {
          "allowComment": false
        }
      ],
      "errors": [
        {
          "messageId": "issue"
        }
      ],
      "output": null
    },
    {
      "code": "if a; elseif b; else; end",
      "errors": [
        {
          "messageId": "issue"
        },
        {
          "messageId": "issue"
        },
        {
          "messageId": "issue"
        }
      ],
      "output": null
    }
  ]
});
