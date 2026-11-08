import { tester, plugin } from '../helpers.js';
tester.run("no-single-iteration-loop", plugin.rules["no-single-iteration-loop"], {
  "valid": [
    "for x in xs; if p(x); break; end; end",
    "for x in xs; p(x) || continue; break; end",
    "for x in xs; consume(x); end",
    "@m for x in xs; break; end",
    "quote while true; break; end; end",
    "for x in xs; f() = 1; break; end",
    "while true; @goto done; break; end"
  ],
  "invalid": [
    {
      "code": "for x in xs; consume(x); break; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "function first_item(xs); for α in xs; return α; end; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    },
    {
      "code": "while ready(); step(); break; end",
      "errors": [
        {
          "messageId": "issue"
        }
      ]
    }
  ]
});
