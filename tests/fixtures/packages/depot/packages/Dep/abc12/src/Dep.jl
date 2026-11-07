module Dep
include("exports.jl")
@reexport using PathDep
@made export manufactured
end
