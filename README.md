# 3D-Plot-Js

Plots functions and .csv files. Scatterplot is also supported. It will plot using three.js. Processing happens client side.

It is written in ES6 syntax and compiled using webpack.

default branch: "threejs"


## Building 3DPlotBundle.js

    npm install
    npm start
    #3DPlotBundle.js is now created in public/3DPlotBundle.js
    firefox public/index.html


## How to Use

first, you need to build. In a console, cd to the project root and use

    npm install
    npm start
    
3DPlotBundle.js will then be created in public/ automatically
    
**Plotting Formulas**

Save the following to a .html file and open it in your browser.

This example is animated because of the interval.

    <div id="JsPlot3DContainer" style="width:100%; height:90vh;"></div>
    <script type="text/javascript" src="3DPlotBundle.js"></script>
    <script>
        var plot = new JSPLOT3D.Plot(document.getElementById("JsPlot3DContainer"))
        plot.setDimensions({xRes: 15, zRes: 15})
        plot.plotFormula("sin(2*x1)*sin(2*x2)")
        var i = 0;
        window.setInterval(function() {
            plot.plotFormula("sin(2*x1+i)*sin(2*x2-i)")
            i += 0.01
        },33.3333) //30fps
    </script>

**Plotting .csv Files**

Save the following to a .html file and open it in your browser.

Configure the 2nd, 3th, 4th and 5th parameter of plot.plotsvString() to your needs. 2-4 are the three columns from the csv file that serve as dimensions of the datapoints. the 5th parameter is the separator of the .csv file format. In example.csv it's ";", in iris.csv it's ","

    <div id="JsPlot3DContainer" style="width:45vw; height:90vh;"></div>
    <input id="fileup" type="file"></input>
    <script type="text/javascript" src="3DPlotBundle.js"></script>
    <script>
        var plot = new JSPLOT3D.Plot(document.getElementById("JsPlot3DContainer"))
        document.getElementById("fileup").addEventListener("change",function(e)
        {
            let file = e.target.files[0]
            let reader = new FileReader()
            reader.readAsDataURL(file)
            let data = ""

            reader.onload = function(e)
            {
                let data = atob(e.target.result.split("base64,")[1])
                plot.plotCsvString(data,0,1,2,";",true) //when trying this out, take care of setting the right separator!
            }
        })
    </script>


## Live Example

first, you need to build. In a console, cd to the project root and use

    npm install
    npm start

open public/index.html in your browser for a live example.

Example for f(x1,x2):

    (cos(x1*10+sin(x2*10)))*0.3

    (Math.cos(x1*10)+Math.sin(x2*10))*0.2

    tanh(x1)! ^ (x2 + sqrt(2))*2 + ln(sin(x2) + e)*2 - π*1.1
    //which is converted to:
    Math2.factorial(Math.tanh(x1))**(x2+Math.sqrt(2))*2+Math2.log2(Math.E,Math.sin(x2)+Math.E)*2-Math.PI*1.1

It has to be in JavaScript syntax, but some common functions are also supported in regular mathematical syntax. the ^ XOR Operator does not work anymore this way though

Take "example.csv" in the root directory of this repository or get a .csv dataset (for example on kaggle.com) and upload it to the upload button of the live example. Type in the indices of the .csv file columns that are used as datapoint dimensions. In the last input field that says "sep" type in the .csv separator. e.g. ; or ,

<p align="center">
  <img width="47%" src="https://raw.githubusercontent.com/sezanzeb/3D-Plot-Js/threejs/scatterplot.png"/>
  <img width="47%" src="https://raw.githubusercontent.com/sezanzeb/3D-Plot-Js/threejs/planeplot.png"/>
</p>


## Todo

- provide default color parameter (in case colorCol remains the default, which is -1)
- move the params of the plot functions that are optional to an optional json object. foo(a,b,c) => foo(a,{"par1":b,"par2":c})
- display box around the plot that has inverse culling, so that the viewer can look inside it. Display a grid texture on it's faces.
- redraw function that can be called after changing the color or dimension settings. For this the dataframe and the settings need to be cached. That means don't overwrite values in the cached dataframe (like the stringlabel -> numberlabel loop does). Make a copy of the cached dataframe and then plot. Or maybe don't overwrite the dataframe but rather create an additional labelarray that carries the label info.
- csvplot: add a mode called "wire". Instead of sprites, connect each datapoint to a wire and use a wireframe material. For this, remove the scatterplot=true parameter, but rather store the mode inside the Plot object. Upon calling one of the Plot.Plot... functions read that mode variable and act accordingly. there would be setters and getters for the mode variable in that case (setModeScatterplot(), setModeMeshplot() and setModeWireplot()). Default would be scatterplot
- csvplot: interpolate the datapoints for 3D Plane based plots
- csvplot: for missing datapoints in the plane, remove the vertex
- heatmapcolor it according to .csv column or height (for functions)
- make it easy to use as a framework and make a doku for it
- csvplot: display the colums that the csv contains in index.html to make selecting the column indices easier
- add some type checking for the functions to make debugging easier
- create setters and maybe move some of the constructor parameters to those (e.g. colors)
- increase redrawing performance, e.g. by not recreating the basic mesh everytime but rather manipulating the vertices (important for animations by doing timed redraws)
- add axis title and numbers
- on submit csvform plot the scatterplot
- made a scatterplot using: https://www.kaggle.com/dalpozz/creditcardfraud/data and it needs to plot faster. If it can't get faster then plot the dataframe over the course of a few intervals so that the interface does not freeze. Maybe I can recycle old particles somehow instead of deleting them and creating the complete plot from scratch

**maybe:**
- for recursive formulas, use scatterplot and plot a datapoint everytime f(x1,x2) gets called. Datapoints, that have been calculated already at some point, are already cached (helps to stop recursion overflows and increases performance)
- for recursive formulas, offer some start value setter


## Creating a doc from the javadoc

    npm install jsdoc -g
    #I had to reboot once afterswards to use the jsdoc command
    jsdoc src/JsPlot3D.js -d ./documentation


## Attribution

iris.csv Dataset by Ronald Fisher
