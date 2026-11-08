# Generate data/stdlib-exports.json: the names each standard library exports (`names(M)`),
# for the Julia version running this script. Usage: julia --startup-file=no scripts/stdlib-exports.jl > data/stdlib-exports.json
stdlib_dir = joinpath(Sys.STDLIB)
mods = sort!(filter(d -> isfile(joinpath(stdlib_dir, d, "src", d * ".jl")), readdir(stdlib_dir)))
out = Dict{String,Vector{String}}()
failed = String[]
for m in mods
    try
        mod = Base.require(Main, Symbol(m))
        out[m] = sort!(unique!([string(n) for n in names(mod) if n !== Symbol(m)]))
    catch err
        push!(failed, m)
    end
end
print("{\n  \"julia\": \"", VERSION, "\",\n  \"failed\": [", join(["\"$f\"" for f in failed], ", "), "],\n  \"modules\": {\n")
ks = sort!(collect(keys(out)))
for (i, k) in enumerate(ks)
    print("    \"", k, "\": [", join(["\"" * escape_string(s) * "\"" for s in out[k]], ", "), "]", i < length(ks) ? ",\n" : "\n")
end
print("  }\n}\n")
