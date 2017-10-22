"use strict"

//start with
//node generateTestCsv.js
const fs = require("fs")

let lines = 500
let csv = new Array(lines)
let firstline = "x;cos;tanh;sqrt;color"

csv[0] = firstline
for(let i = 1;i < lines; i++)
{
    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "RGB("+(1-i/lines)+","+1+","+i/lines+")"
}

/*  let hexTest = parseInt((i/lines)*255).toString(16)
    if(hexTest.length == 1)
        hexTest = "0"+hexTest

    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "#"+"33"+"ff"+hexTest*/

function rand()
{
    let a = Math.pow(Math.random()-0.5,3)
    let b = Math.pow(Math.random()-0.5,5)*7
    let c = Math.pow(Math.random()-0.5,7)*50
    return a + b + c
}

fs.writeFileSync("../example.csv",csv.join("\n"))