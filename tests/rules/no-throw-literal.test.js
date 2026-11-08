import { tester, plugin } from '../helpers.js';
tester.run("no-throw-literal", plugin.rules["no-throw-literal"], {
  "valid": [
    "throw(ArgumentError(\"bad\"))",
    "f(throw)=throw(42)",
    "f(nothing)=throw(nothing)",
    "@m throw(42)",
    "quote throw(42); end",
    "throw(\"value: $x\")",
    "f(x)=throw(x)"
  ],
  "invalid": [
    {
      "code": "throw(\"α\")",
      "errors": [
        {
          "messageId": "issue",
          "suggestions": [
            {
              "messageId": "replace",
              "data": {
                "message": "Use Base.error(\"α\")."
              },
              "output": "Base.error(\"α\")"
            }
          ]
        }
      ]
    },
    {
      "code": "throw(42)",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "throw(nothing)",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "throw(true)",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "throw('α')",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "Core.throw(missing)",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    }
  ]
});
