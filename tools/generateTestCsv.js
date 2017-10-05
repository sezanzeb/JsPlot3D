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
        "RGB("+i/lines+","+i/lines+","+i/lines+")"
}

//between -0.1 and 0.1
function rand()
{
    return Math.pow(Math.random()-0.5,3)
}

fs.writeFileSync("./example.csv",csv.join("\n"))