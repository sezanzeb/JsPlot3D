# 3D-Plot-Js

Plots functions aswell as .csv data

There will be an upload button that lets you upload a .csv file, afterwards you will be able to select the x1, the x2 and x3 axis. Alternatively input a formula f(x1,x2) which will be plotted. Recursive definitions will work as well as long as I can figure out a appropriate overflow protection. It will plot using babylon.js. Processing will happen client side. It will color the x3 axis according to a heatmap.

It will be written in ES6 syntax and compiled using webpack.

<p align="center">
  <img width="60%" src="https://raw.githubusercontent.com/sezanzeb/3D-Plot-Js/master/screenshot.png"/>
</p>

## how to

open public/index.html in your browser

Example for f(x1,x2):

    (cos(x1*10+sin(x2*10)))*0.3

    (Math.cos(x1*10)+Math.sin(x2*10))*0.2

    tanh(x1)! ^ (x2 + sqrt(2))*2 + ln(sin(x2) + e)*2 - π*1.1
    //which is converted to:
    Math2.factorial(Math.tanh(x1))**(x2+Math.sqrt(2))*2+Math2.log2(Math.E,Math.sin(x2)+Math.E)*2-Math.PI*1.1

It has to be in JavaScript syntax, but some common functions are also supported in regular mathematical syntax. the ^ XOR Operator does not work anymore this way though

## building

    npm install
    npm start
    firefox public/index.html


## Todo

- process .csv files
- heatmapcolor it
- support scatterplots (make dropdown to select plotting type)
- make it easy to use as a framework and make a doku for it