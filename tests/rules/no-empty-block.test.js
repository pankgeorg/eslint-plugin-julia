import { tester, plugin } from '../helpers.js';
tester.run('no-empty-block', plugin.rules['no-empty-block'], {
  "valid": [
    'function f(); end',
    'function 🐱(α); end',
    'function f(x::T) where T; end',
    'function f(x)::Nothing; end',
    'function Base.show(io::IO, x::Int); end',
    'function (f::F)(x) where F; end',
    'function +(x, y); end',
    'function NoOp(); end',
    { code: 'function f(); end', options: [{ allowComment: false }] },
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
    { code: 'function f(); if ready; end; end', errors: [{ messageId: 'issue' }] },
    { code: 'function f(); for x in xs; end; end', errors: [{ messageId: 'issue' }] },
    { code: 'function f(); while ready; end; end', errors: [{ messageId: 'issue' }] },
    { code: 'function f(); let; end; end', errors: [{ messageId: 'issue' }] },
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
