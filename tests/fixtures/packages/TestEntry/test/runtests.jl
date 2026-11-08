import TestEntry as m
using Dates: year
include("helpers.jl")
@timed_include "child.jl"
@unrecognized "orphan.jl"
@timed_include string("orphan.jl")
macro decoy(path)
    :(include($path))
    nothing
end
@decoy "orphan.jl"
