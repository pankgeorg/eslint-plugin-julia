import { tester, plugin } from '../helpers.js';
const invalid = (code, output, options) => ({
  code,
  ...(options && { options }),
  errors: [{ messageId: 'diagnostic', suggestions: [{ messageId: 'replace', output }] }],
});
tester.run('prefer-sized-push-buffer', plugin.rules['prefer-sized-push-buffer'], {
  valid: [
    'function f(); a=Int[]; for i in 1:15; push!(a,i); end; a; end',
    'function f(); a=sizehint!(Int[],100); for i in 1:100; push!(a,i); end; end',
    'function f(xs); a=Int[]; for x in xs; push!(a,x); end; end',
    'function f(); a=Int[]; for i in 1:100; if i>2; push!(a,i); end; end; end',
    'function f(); a=Int[]; for i in 1:100; push!(a,i); consume(a); end; end',
    'function f(push!); a=Int[]; for i in 1:100; push!(a,i); end; end',
    'function f(Int); a=Int[]; for i in 1:100; push!(a,i); end; end',
    '@m function f(); a=Int[]; for i in 1:100; push!(a,i); end; end',
    'quote function f(); a=Int[]; for i in 1:100; push!(a,i); end; end end',
    'function f(); a=Int[]; for i in 1:0:100; push!(a,i); end; end',
    'function f(); a=Int[]; for i in 1:100; push!(a,@m i); end; end',
    'function f(); a=Int[]; for i in 1:100; push!(a,length(a)); end; end',
    'function f(); a=Int[]; for i in 1:100; push!(a,i); ()->a; end; end',
  ],
  invalid: [
    invalid(
      'function f(); a=Int[]; for i in 1:100; push!(a,i); end; a; end',
      'function f(); a=Int[]\nBase.sizehint!(a, 100); for i in 1:100; push!(a,i); end; a; end',
    ),
    invalid(
      'function f(); α=[]; for i in 32:-1:1; Base.push!(α,i); end; end',
      'function f(); α=[]\nBase.sizehint!(α, 32); for i in 32:-1:1; Base.push!(α,i); end; end',
    ),
    invalid(
      'function f(); a=Vector{Int}(); for i in 2:2:64; push!(a,i); end; end',
      'function f(); a=Vector{Int}()\nBase.sizehint!(a, 32); for i in 2:2:64; push!(a,i); end; end',
    ),
    invalid(
      'function f(); a=String[]; for i in 1:2; push!(a,"λ"); end; end',
      'function f(); a=String[]\nBase.sizehint!(a, 2); for i in 1:2; push!(a,"λ"); end; end',
      [{ minimumIterations: 2 }],
    ),
  ],
});
