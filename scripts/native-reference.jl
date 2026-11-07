# Optional maintainer oracle: Julia 1.13.2, no packages. Filenames supplied in order.
# Outputs one JSON array of raw flags arrays, supplementing jlparse_reference.json.
# Example: julia --startup-file=no scripts/native-reference.jl sources/*.jl > flags.json
include("parser.jl")
VERSION == v"1.13.2" || error("Reference requires Julia 1.13.2")
print('[')
for (index, path) in enumerate(ARGS)
    index > 1 && print(',')
    bytes = read(path)
    src_resize(Int32(length(bytes)))
    for (i, byte) in enumerate(bytes)
        src_set(Int32(i), Int32(byte))
    end
    count = parse_src(Int32(1))
    print('[')
    for i in Int32(1):count
        i > 1 && print(',')
        print(out_flags(i))
    end
    print(']')
end
println(']')
