# Optional evidence regeneration; no evaluation of the supplied expressions.
VERSION == v"1.13.2" || error("Evidence requires Julia 1.13.2")
for source in ["f(a=1,a=2)", "f(;a=1,a=2)", "f(a=1;a=2)", "struct S; x; x; end"]
    println(source)
    println(Meta.lower(Main, Meta.parse(source)))
end
