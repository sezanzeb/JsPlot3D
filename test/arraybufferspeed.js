"use strict"
let starttime
let time
let size = 20000000
let result


let bla = 0
let foo = [1,2,3,4,5,6,7,8,9,"asdf",7564,15,136,36475,2547,64,25764,427,4275,2357,1346,28,1,647,76,15,7,147,154,"bla",257,2,457,24,5,72,45,7,245,245,6,14,75145,7,154,1,534,147,145]
function getNext()
{
    bla ++
    return foo[bla%foo.length]
}


starttime = new Date().getTime()
let array1 = new Array(size)
for(let i = 0;i < array1.length; i++)
{
    let rand = getNext() * 8
    if(!isNaN(rand))
        array1[i] = parseInt(rand)
    else
        array1[i] = 0
}
result = 0
for(let i = 0;i < array1.length; i++)
{
    result += array1[i] * 2
}
console.log("Standard:",new Date().getTime() - starttime,result)



starttime = new Date().getTime()
let array2 = new Int32Array(size)
for(let i = 0;i < array2.length; i++)
{
    let rand = getNext() << 3 | 0
    array2[i] = rand
}
result = 0
for(let i = 0;i < array2.length; i++)
{
    result += array2[i] << 1
}
console.log("Nicer   :",new Date().getTime() - starttime,result)