import {tester,plugin} from '../helpers.js';
tester.run("prefer-eachindex",plugin.rules["prefer-eachindex"],{
  "valid": [
    "for i in eachindex(xs); consume(xs[i]); end",
    "for i in 1:length(xs); consume(i,xs[i]); end",
    "for i in 1:length(xs); consume(ys[i]); end",
    "for i in 1:length(xs); xs[i]; push!(xs,1); end",
    "for i in 1:length(xs); xs[i]; i=2; end",
    "for i in 1:length(xs); ()->xs[i]; end",
    "f(length,xs)=[xs[i] for i in 1:length(xs)]",
    "@m for i in 1:length(xs); xs[i]; end"
  ],
  "invalid": [
    {
      "code": "for i in 1:length(xs); consume(xs[i]); end",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "for i in Base.eachindex(xs); consume(xs[i]); end"
            }
          ]
        }
      ]
    },
    {
      "code": "[xs[i] for i in 1:length(xs)]",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "[xs[i] for i in Base.eachindex(xs)]"
            }
          ]
        }
      ]
    },
    {
      "code": "function total(xs); s=0; for i in 1:length(xs); s+=xs[i]; end; s; end",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "function total(xs); s=0; for i in Base.eachindex(xs); s+=xs[i]; end; s; end"
            }
          ]
        }
      ]
    },
    {
      "code": "[🐱[i] for i in 1:length(🐱)]",
      "errors": [
        {
          "messageId": "diagnostic",
          "suggestions": [
            {
              "messageId": "replace",
              "output": "[🐱[i] for i in Base.eachindex(🐱)]"
            }
          ]
        }
      ]
    }
  ]
});
