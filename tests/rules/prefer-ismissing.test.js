import {tester,plugin} from '../helpers.js';
tester.run("prefer-ismissing",plugin.rules["prefer-ismissing"],{
  "valid": ["f(var\"==\",x)=x==missing",
    "ismissing(x)",
    "f(x)=ismissing(x) ? 0 : 1",
    "x === missing",
    "f(missing,x)=x==missing",
    "@m x==missing",
    "quote x==missing; end",
    {
      "code": "f(x)=x==missing",
      "options": [
        {
          "onlyConditions": true
        }
      ]
    }
  ],
  "invalid": [
    {
      "code": "x == missing",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "Base.ismissing(x)"
            }
          ]
        }
      ]
    },
    {
      "code": "missing != x",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "!Base.ismissing(x)"
            }
          ]
        }
      ]
    },
    {
      "code": "f(x)=x==missing ? 0 : 1",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(x)=Base.ismissing(x) ? 0 : 1"
            }
          ]
        }
      ]
    },
    {
      "code": "f(x)=if x!=missing; x; else 0; end",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(x)=if !Base.ismissing(x); x; else 0; end"
            }
          ]
        }
      ]
    },
    {
      "code": "f(x)=(missing==x)&&println(x)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(x)=(Base.ismissing(x))&&println(x)"
            }
          ]
        }
      ]
    },
    {
      "code": "f(🐱)=🐱==missing",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(🐱)=Base.ismissing(🐱)"
            }
          ]
        }
      ]
    }
  ]
});
