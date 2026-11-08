baremodule Base
include(path) = nothing
include("core.jl")
end
module Base; include("nested/bootstrap.jl"); end
