"use strict"

//start with
//node generateTestCsv.js
const fs = require("fs")

let lines = 10
let firstline = "x;cos;tanh;sqrt;color"

function rand()
{
    return 0
}

/////////////// RGB ///////////////

let csv = new Array(lines)
csv[0] = firstline
for(let i = 1;i < lines; i++)
{
    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "RGB(" + (i / lines) + "," + (i / lines) + "," + (i / lines) + ")"
}

//from RGB(0,0,0)
//to   RGB(0,1,1)

fs.writeFileSync("../exampleRGB.csv",csv.join("\n"))



/////////////// HSL ///////////////

csv = new Array(lines)
csv[0] = firstline
for(let i = 1;i < lines; i++)
{
    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "HSL(" + 0 + "," + 0 + "," + (i/lines) + ")"
}

//from HSL(0, 0, 0)
//to   HSL(0, 0, 1)

fs.writeFileSync("../exampleHSL.csv",csv.join("\n"))



/////////////// HEXADECIMAL ///////////////

csv = new Array(lines)
csv[0] = firstline
for(let i = 1;i < lines; i++)
{
    let r = parseInt((i / lines)*255).toString(16)
    let g = parseInt((i / lines)*255).toString(16)
    let b = parseInt((i / lines)*255).toString(16)
    if(r.length == 1)
        r = "0"+r
    if(g.length == 1)
        g = "0"+g
    if(g.length == 1)
        g = "0"+g

    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "#"+r+g+b
}

//from #808080
//to   #00ffff

fs.writeFileSync("../exampleHEX.csv",csv.join("\n"))



/////////////// INTEGERS ///////////////

csv = new Array(lines)
csv[0] = firstline
for(let i = 1;i < lines; i++)
{
    let r = parseInt((i / lines)*255).toString(16)
    let g = parseInt((i / lines)*255).toString(16)
    let b = parseInt((i / lines)*255).toString(16)
    if(r.length == 1)
        r = "0"+r
    if(g.length == 1)
        g = "0"+g
    if(g.length == 1)
        g = "0"+g

    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        parseInt(r+g+b,16)
}

//from #808080
//to   #00ffff

fs.writeFileSync("../exampleINT.csv",csv.join("\n"))


/////////////// LABELED ///////////////

csv = new Array(lines)
csv[0] = firstline
let i = 1
for(;i < lines/3*1; i++)
{
    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "tree"
}
for(;i < lines/3*2; i++)
{
    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "flower"
}
for(;i < lines/3*3; i++)
{
    csv[i] = i+";"+
        (Math.cos(i/100)+rand())+";"+
        (Math.tanh(i/100)+rand())+";"+
        (Math.sqrt(i/100)+rand())+";"+
        "painting"
}

fs.writeFileSync("../exampleLabeled.csv",csv.join("\n"))