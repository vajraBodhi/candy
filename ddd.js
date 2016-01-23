define(["aaa",
"bbb",
"ccc",
"fff"],function(a,b,c,f){
    console.log("已加载ddd模块", 7);
    return {
		bbb: b,
        ddd: "ddd",
        length: arguments.length
    }
})

