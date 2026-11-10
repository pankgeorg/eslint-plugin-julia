# Generate data/stdlib-exports.json: the names each standard library exports or declares public
# (`names(M)`), and the same for their submodules and Base's/Core's submodules under dotted keys
# (`Base.BinaryPlatforms`, `LinearAlgebra.BLAS`), for the Julia version running this script.
# Usage: julia --startup-file=no scripts/stdlib-exports.jl > data/stdlib-exports.json
stdlib_dir = joinpath(Sys.STDLIB)
mods = sort!(filter(d -> isfile(joinpath(stdlib_dir, d, "src", d * ".jl")), readdir(stdlib_dir)))
out = Dict{String,Vector{String}}()
failed = String[]
inventory(mod) = sort!(unique!([string(n) for n in names(mod) if n !== nameof(mod)]))
# Submodules defined inside `mod` (not aliases of other modules), recursively.
function submodules!(out, mod, path, seen = Set{Module}())
    mod in seen && return
    push!(seen, mod)
    for n in names(mod; all = true)
        isdefined(mod, n) || continue
        v = getfield(mod, n)
        (v isa Module && v !== mod && parentmodule(v) === mod && nameof(v) === n) || continue
        startswith(string(n), '#') && continue
        key = string(path, '.', n)
        out[key] = inventory(v)
        submodules!(out, v, key, seen)
    end
end
for m in mods
    try
        mod = Base.require(Main, Symbol(m))
        out[m] = inventory(mod)
        submodules!(out, mod, m)
    catch err
        push!(failed, m)
    end
end
# Base's and Core's own inventories live in data/base-core-exports.json; their submodules here.
submodules!(out, Base, "Base")
submodules!(out, Core, "Core")
print("{\n  \"julia\": \"", VERSION, "\",\n  \"failed\": [", join(["\"$f\"" for f in failed], ", "), "],\n  \"modules\": {\n")
ks = sort!(collect(keys(out)))
for (i, k) in enumerate(ks)
    print("    \"", k, "\": [", join(["\"" * escape_string(s) * "\"" for s in out[k]], ", "), "]", i < length(ks) ? ",\n" : "\n")
end
print("  }\n}\n")
