import { tester, plugin } from '../helpers.js';
tester.run('no-unsafe-negation', plugin.rules['no-unsafe-negation'], {
  "valid": [
    "!(x in values)",
    "(!x) == y",
    "(!a) in b",
    "!x .== y",
    "@m !x == y",
    "quote !x in values end",
    "f(!x)"
  ],
  "invalid": [
    {
      "code": "!x in values",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "(!x) in values"
            },
            {
              "messageId": "whole",
              "output": "!(x in values)"
            }
          ]
        }
      ],
      "output": null
    },
    {
      "code": "!x == y",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "(!x) == y"
            },
            {
              "messageId": "whole",
              "output": "!(x == y)"
            }
          ]
        }
      ],
      "output": null
    },
    {
      "code": "!x < y",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "(!x) < y"
            },
            {
              "messageId": "whole",
              "output": "!(x < y)"
            }
          ]
        }
      ],
      "output": null
    },
    {
      "code": "!a isa T",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "(!a) isa T"
            },
            {
              "messageId": "whole",
              "output": "!(a isa T)"
            }
          ]
        }
      ],
      "output": null
    },
    {
      "code": "!α ∈ β",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "(!α) ∈ β"
            },
            {
              "messageId": "whole",
              "output": "!(α ∈ β)"
            }
          ]
        }
      ],
      "output": null
    },
    {
      "code": "!a < b < c",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "(!a) < b < c"
            },
            {
              "messageId": "whole",
              "output": "!(a < b < c)"
            }
          ]
        }
      ],
      "output": null
    },
    {
      "code": "!α ≤ β",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "(!α) ≤ β"
            },
            {
              "messageId": "whole",
              "output": "!(α ≤ β)"
            }
          ]
        }
      ],
      "output": null
    },
    {
      "code": "function 🐱(); !α != β; end",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "left",
              "output": "function 🐱(); (!α) != β; end"
            },
            {
              "messageId": "whole",
              "output": "function 🐱(); !(α != β); end"
            }
          ]
        }
      ],
      "output": null
    }
  ]
});
