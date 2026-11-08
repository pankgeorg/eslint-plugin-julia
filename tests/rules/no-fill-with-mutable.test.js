import {tester,plugin} from '../helpers.js';
tester.run("no-fill-with-mutable",plugin.rules["no-fill-with-mutable"],{
  "valid": [
    "fill(0,3)",
    "[Int[] for _ in 1:3]",
    "fill([],1)",
    "fill([],0)",
    "f(fill)=fill([],3)",
    "f(Dict)=fill(Dict(),3)",
    "@m fill([],3)",
    "quote fill([],3); end",
    {
      "code": "fill([],n)",
      "options": [
        {
          "unknownDimensions": false
        }
      ]
    }
  ],
  "invalid": [
    {
      "code": "fill([],3)",
      "errors": [
        {
          "messageId": "diagnostic"
        }
      ]
    },
    {
      "code": "fill(Dict{Symbol,Int}(),2)",
      "errors": [
        {
          "messageId": "diagnostic"
        }
      ]
    },
    {
      "code": "fill(Ref(0),(2,2))",
      "errors": [
        {
          "messageId": "diagnostic"
        }
      ]
    },
    {
      "code": "fill(zeros(3),n)",
      "errors": [
        {
          "messageId": "diagnostic"
        }
      ]
    },
    {
      "code": "fill([],n)",
      "errors": [
        {
          "messageId": "diagnostic"
        }
      ]
    },
    {
      "code": "fill(Int[1],3)",
      "errors": [
        {
          "messageId": "diagnostic"
        }
      ]
    },
    {
      "code": "f(🐱)=fill([],🐱)",
      "errors": [
        {
          "messageId": "diagnostic"
        }
      ]
    }
  ]
});
