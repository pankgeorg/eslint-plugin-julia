test_helper() = 1
macro timed_include(path::AbstractString)
    :(@time include($path))
end
