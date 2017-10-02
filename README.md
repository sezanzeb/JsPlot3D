# 3D-Plot-Js

Plots functions aswell as .csv data

There will be an upload button that lets you upload a .csv file, afterwards you will be able to select the x1, the x2 and x3 axis.

Alternatively input a formula f(x1,x2) which will be plotted. Recursive definitions will work as well as long as I can figure out a appropriate overflow protection

It will plot using babylon.js. I'm not sure yet whether or not it will process the data server or client side. Formula plotting will hapen client side for sure for security reasons.

It will be written in ES6 syntax and compiled using webpack
