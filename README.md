<p align="center"><img width="32%" src="https://raw.githubusercontent.com/sezanzeb/JsPlot3D/master/images/title.png"/></p>

**v0.1-beta**

Plots functions and .csv files. Based on three.js. It is written in ES6 syntax and compiled using Webpack.

<p align="center">
    <img width="23%" src="https://raw.githubusercontent.com/sezanzeb/JsPlot3D/master/images/scatterplots1.png">
    <img width="23%" src="https://raw.githubusercontent.com/sezanzeb/JsPlot3D/master/images/scatterplots2.png">
    <img width="23%" src="https://raw.githubusercontent.com/sezanzeb/JsPlot3D/master/images/barcharts1.png">
    <img width="23%" src="https://raw.githubusercontent.com/sezanzeb/JsPlot3D/master/images/barcharts2.png">
</p>

Download: http://hip70890b.de/downloads/JsPlot3D.js

For more information please take a look at https://github.com/sezanzeb/JsPlot3D/blob/master/MORE.md

You can find the **documentation** here: https://doclets.io/sezanzeb/JsPlot3D/master/overwiew


## Live Example

Click here for a live example:

http://hip70890b.de/JsPlot3D_Playground/

You can uploade one of the csvs in /examples/csvFiles, Recommended are Iris.csv, example2.csv and example.csv. Or get a .csv dataset (for example on kaggle.com). The live example also gives insight about the settings that can be handed over to plotCsvString, plotDataFrame, plotFormula and addDataPoint.


## Features

- optimized for animations
- scatterplots
- coloring datalabels
- heatmaps
- validates and plots formulas (supports polygons as output)
- barcharts
- creating legends
- reads .csv files


## Example

Please also take a look at the source codes of https://github.com/sezanzeb/JsPlot3D/tree/master/test because there are quite a few examples that show what you can do with this tool, also when it comes to **animating**

you can build JsPlot3D yourself using the following command:

    npm install && npm start

and find it afterwards in compiled/JsPlot3D.js

    <div id="plot" style="width:400px; height:350px;"></div>
    <div id="legend"></div>
    <div style="display:none" id="csv">
        SepalLength,SepalWidth,PetalLength,PetalWidth,Name
        5.1,3.5,1.4,0.2,Iris-setosa
        4.9,3.0,1.4,0.2,Iris-setosa
        7.0,3.2,4.7,1.4,Iris-versicolor
        6.4,3.2,4.5,1.5,Iris-versicolor
        6.3,3.3,6.0,2.5,Iris-virginica
        5.8,2.7,5.1,1.9,Iris-virginica
    </div>
    <script src="http://threejs.org/build/three.min.js"></script>
    <script src="http://hip70890b.de/downloads/JsPlot3D.js"></script>
    <script>

        var plot = new JSPLOT3D.Plot(document.getElementById("plot"))
        var data = document.getElementById("csv").innerHTML
        plot.plotCsvString(data,0,1,2,{
            dataPointSize:0.1,
            labeled:true,
            colorCol:4
        })
        plot.createLegend(document.getElementById("legend"))
        
    </script>
    <style>
        body {font-family:sans-serif; }

        .jsP3D_labelColor {
            width: 10px;
            height: 10px;
            display: inline-block;
            border-radius:100%;
        }
    </style>
