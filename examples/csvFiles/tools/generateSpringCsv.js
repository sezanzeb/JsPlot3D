"use strict"

//start with
//node generateTestCsv.js
const fs = require("fs")

let lines = 300
let csv = new Array(lines)
let firstline = "x^3;sin;cos"
let label = "frog"

csv[0] = firstline
// makes a spring that expands when i increases, each datapoint has somewhat the same distance from that before
for(let i = 1;i < lines; i++)
{
    csv[i] = Math.pow(i/100,3) +";"+
        Math.sin(i/5)+";"+
        Math.cos(i/5)+";"+
        label
        
    if(i > 120)
        label = "horse"

    if(i > 200)
        label = "bird"
        
    if(i > 250)
        label = "fox"
}

fs.writeFileSync("../spring.csv",csv.join("\n"))