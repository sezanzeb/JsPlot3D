"use strict"
let starttime
let time
let size = 20000000
let result


function getNext()
{
    let a = Math.random()
    if(Math.abs(a) > 0.5)
        a += "_"
    return a
}


starttime = new Date().getTime()
result = 0
for(let i = 0;i < size; i++)
{
    if(0 === getNext())
        result ++
}
console.log(new Date().getTime() - starttime,result)



starttime = new Date().getTime()
result = 0
for(let i = 0;i < size; i++)
{
    if(0 == getNext())
        result ++
}
console.log(new Date().getTime() - starttime,result)