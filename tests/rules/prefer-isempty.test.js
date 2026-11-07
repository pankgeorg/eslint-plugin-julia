import {tester,plugin} from '../helpers.js';
tester.run("prefer-isempty",plugin.rules["prefer-isempty"],{
  "valid": [
    "f(var\"==\",xs)=length(xs)==0",
    "isempty(xs)",
    "length(xs)==2",
    "f(xs)=!isempty(xs)",
    "f(length,x)=length(x)==0",
    "length(xs)>=0",
    "length(xs)<0",
    "x .== 0",
    "@m length(x)==0",
    "quote length(x)==0; end",
    {
      "code": "length(x)==0",
      "options": [
        {
          "allowLengthComparison": true
        }
      ]
    },
    {
      "code": "size(x,1)==0",
      "options": [
        {
          "dimensions": false
        }
      ]
    }
  ],
  "invalid": [
    {
      "code": "length(xs)==0",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "Base.isempty(xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "0==length(xs)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "Base.isempty(xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "length(xs)>0",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "!Base.isempty(xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "f(xs)=length(xs)>0",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(xs)=!Base.isempty(xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "f(xs)=length(xs)==0",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(xs)=Base.isempty(xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "f(xs)=0!=length(xs)",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(xs)=!Base.isempty(xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "length(xs)<1",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "Base.isempty(xs)"
            }
          ]
        }
      ]
    },
    {
      "code": "size(x,1)==0",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "Base.isempty(x)"
            }
          ]
        }
      ]
    },
    {
      "code": "f(🐱)=length(🐱)>0",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "f(🐱)=!Base.isempty(🐱)"
            }
          ]
        }
      ]
    }
  ]
});
