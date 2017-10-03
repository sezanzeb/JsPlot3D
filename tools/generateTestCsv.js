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
    csv[i] = i+";"+Math.cos(i)+";"+Math.tanh(i)+";"+Math.sqrt(i)+";RGB("+i/lines+","+i/lines+","+i/lines+")"
}

fs.writeFileSync("./example.csv",csv.join("\n"))