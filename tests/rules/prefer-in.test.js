import {tester,plugin} from '../helpers.js';
tester.run("prefer-in",plugin.rules["prefer-in"],{
  "valid": [
    "Base.in(x, xs::MyCollection)=any(==(x),xs)",
    "function Base.in(x,xs::MyCollection); any(y->y==x,xs); end",
    "needle in haystack",
    "any(isequal(needle),haystack)",
    "any(x->x===needle,haystack)",
    "any(x->x==x,haystack)",
    "any(x->x==make(),haystack)",
    "any(x->begin x==needle; true; end,haystack)",
    "f(any,xs)=any(==(x),xs)",
    "@m any(==(x),xs)",
    "quote any(==(x),xs); end"
  ],
  "invalid": [
    {
      "code": "any(==(needle),haystack)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "(needle in haystack)"
            }
          ]
        }
      ]
    },
    {
      "code": "any(item->item==needle,haystack)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "(needle in haystack)"
            }
          ]
        }
      ]
    },
    {
      "code": "any(item->needle==item,haystack)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "(needle in haystack)"
            }
          ]
        }
      ]
    },
    {
      "code": "any(🐱->🐱==needle,xs)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "(needle in xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "any(==(1),xs)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "(1 in xs)"
            }
          ]
        }
      ]
    }
  ]
});
