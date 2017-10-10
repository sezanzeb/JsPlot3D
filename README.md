# JsPlot3D

Plots functions and .csv files. Scatterplot is also supported. It will plot using three.js. Processing happens client side.

It is written in ES6 syntax and compiled using webpack.

default branch: "threejs"


## Building 3DPlotBundle.js

    npm install
    npm start
    #3JsPlot3D.js is now created in compiled/JsPlot3D.js
    #to minify the file, add the -p parameter to webpack in scripts.start in package.json


## How to Use

first, you need to build. See above.
    
JsPlot3D.js will then be created in compiled/ automatically
    
**Plotting Formulas**

see examples/test/b.html

**Plotting .csv Files**

see examples/test/a.html

## Live Example

first, you need to build. See above.

open examples/index.html in your browser for a live example.

Example for f(x1,x2):

    (cos(x1*10+sin(x2*10)))*0.3

    (Math.cos(x1*10)+Math.sin(x2*10))*0.2

    tanh(x1)! ^ (x2 + sqrt(2))*2 + ln(sin(x2) + e)*2 - π*1.1

It has to be in JavaScript syntax, but some common functions are also supported in regular mathematical syntax. the ^ XOR Operator does not work anymore this way though

Take "example.csv" in the root directory of this repository or get a .csv dataset (for example on kaggle.com) and upload it to the upload button of the live example. Type in the indices of the .csv file columns that are used as datapoint dimensions. In the last input field that says "sep" type in the .csv separator. e.g. ; or ,

**it should look similar to this:***

<p align="center">
  <img width="47%" src="https://raw.githubusercontent.com/sezanzeb/3D-Plot-Js/threejs/scatterplot.png"/>
  <img width="47%" src="https://raw.githubusercontent.com/sezanzeb/3D-Plot-Js/threejs/planeplot.png"/>
</p>


## Todo

- display box around the plot that has inverse culling, so that the viewer can look inside it. Display a grid texture on it's faces.
- redraw function that can be called after changing the color or dimension settings. For this the dataframe and the settings need to be cached. That means don't overwrite values in the cached dataframe (like the stringlabel -> numberlabel loop does). Make a copy of the cached dataframe and then plot. Or maybe don't overwrite the dataframe but rather create an additional labelarray that carries the label info.
- csvplot: add a mode called "wire". Instead of sprites, connect each datapoint to a wire and use a wireframe material. For this, remove the scatterplot=true parameter, but rather store the mode inside the Plot object. Upon calling one of the Plot.Plot... functions read that mode variable and act accordingly. there would be setters and getters for the mode variable in that case (setModeScatterplot(), setModeMeshplot() and setModeWireplot()). Default would be scatterplot
- csvplot: interpolate the datapoints for 3D Plane based plots
- csvplot: for missing datapoints in the plane, remove the vertex
- heatmapcolor it according to functino height
- make it easy to use as a framework and make a doku for it
- csvplot: display the colums that the csv contains in index.html to make selecting the column indices easier
- create setters and maybe move some of the constructor parameters to those (e.g. colors)
- add axis title and numbers
- on submit csvform plot the scatterplot in examples/index.html
- how is the performance for very large dataframes? base64 decoding the uplaoded file takes ages and I can't change that. what about the plotting itself?

**maybe:**
- for recursive formulas, use scatterplot and plot a datapoint everytime f(x1,x2) gets called. Datapoints, that have been calculated already at some point, are already cached (helps to stop recursion overflows and increases performance)
- for recursive formulas, offer some start value setter


## Creating a doc from the javadoc

    npm install jsdoc -g
    #I had to reboot once afterswards to use the jsdoc command
    jsdoc src/JsPlot3D.js -d ./documentation


## Attribution

iris.csv Dataset by Ronald Fisher
