# Generate data/public-only.json: for Base, Core, the standard libraries and their submodules,
# the names that are declared `public` but not exported. `names(M)` (the inventories in
# data/base-core-exports.json and data/stdlib-exports.json) lists both; `using M` brings in only
# the exported ones.
# Usage: julia --startup-file=no scripts/public-only.jl > data/public-only.json
stdlib_dir = Sys.STDLIB
mods = sort!(filter(d -> isfile(joinpath(stdlib_dir, d, "src", d * ".jl")), readdir(stdlib_dir)))
out = Dict{String,Vector{String}}()
publiconly(mod) = sort!([string(n) for n in names(mod) if n !== nameof(mod) && !Base.isexported(mod, n)])
function walk!(mod, path, seen = Set{Module}())
    mod in seen && return
    push!(seen, mod)
    p = publiconly(mod)
    isempty(p) || (out[path] = p)
    for n in names(mod; all = true)
        isdefined(mod, n) || continue
        v = getfield(mod, n)
        (v isa Module && v !== mod && parentmodule(v) === mod && nameof(v) === n) || continue
        startswith(string(n), '#') && continue
        walk!(v, string(path, '.', n), seen)
    end
end
for m in mods
    try
        walk!(Base.require(Main, Symbol(m)), m)
    catch
    end
end
walk!(Base, "Base")
walk!(Core, "Core")
ks = sort!(collect(keys(out)))
print("{\n  \"julia\": \"", VERSION, "\",\n  \"modules\": {\n")
for (i, k) in enumerate(ks)
    print("    \"", k, "\": [", join(["\"" * escape_string(s) * "\"" for s in out[k]], ", "), "]", i < length(ks) ? ",\n" : "\n")
end
print("  }\n}\n")
