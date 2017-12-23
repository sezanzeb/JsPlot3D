# Usage

1. A very basic example that runs when saved to a .html file can be found in the readme of the root directory: https://github.com/sezanzeb/JsPlot3D/

2. To learn how to navigate and also understand many of the available settings, please open http://hip70890b.de/JsPlot3D/examples/playground/index.html in your browser.

3. There are a few examples listed here: https://github.com/sezanzeb/JsPlot3D/tree/master/test/visual_tests, so you can see how the various ways to plot data work. Note, that some of them contain settings that are not needed but only exist to test if the plot breaks or not.

4. Also see the documentation, which you can find here: https://doclets.io/sezanzeb/JsPlot3D/master ("API")


**The first steps for everything here are the following:**

Build instructions for JsPlot3D.js are available here: https://github.com/sezanzeb/JsPlot3D/blob/master/MORE.md and a precompiled file is available here: http://hip70890b.de/JsPlot3D/compiled/JsPlot3D.js.

The following links the scripts and creates an element as container.

```html
    <script src="https://threejs.org/build/three.js"></script>
    <script type="text/javascript" src="JsPlot3D.js"></script>
    <div style="width:300px; height:300px" id="foobar"></div>
```

Create a new instance of Plot ("foobar" is the id of the container in the previous step)

```js
    var plot = new JSPLOT3D.Plot(document.getElementById("foobar"))
```

<br/>

## Modes

You can use constants to change the mode. The variable "data" is a string that contains csv information, separated by linebreaks \n, like this: "a,b,c\n1,2,3".

(**plotDataFrame** is also available, which uses an array of arrays of values as first parameter, like this: [["a", "b", "c"],[1, 2, 3]])

```js
    plot.plotCsvString(data, 0, 1, 2, {
        mode: JSPLOT3D.SCATTERPLOT_MODE
    })
```

As you can see, the fifth parameter of plotCsvString is an object that can contain settings. For a list of all available settings, go to the api documentation here: https://doclets.io/sezanzeb/JsPlot3D/master and scroll down to "plotCsvString".

The first parameter is a string that contains csv formatted data. The second, third and fourth parameter are the column indices which are used to plot 3D data.

Here are the modes and their values:

```js
    SCATTERPLOT_MODE = "scatterplot"
    BARCHART_MODE = "barchart"
    LINEPLOT_MODE = "lineplot" // works only for data frames or csv data
    POLYGON_MODE = "polygon" // works only for formulas
```

<br/>

## Displaying Labeled Data

it works with all modes (Except polygon, which is not available outside of plotFormula)

```js
    var data = "x;y;z;label\n"+
               "1;2;3;tree\n"+
               "1;2;4;flower\n"+
               "2;1;5;painting\n"

    plot.plotCsvString(data, 0, 1, 2, {
        labeled: true,
        colorCol: 3,
        header: true,
        separator: ";",
        dataPointSize: 0.5
    })
```

<br/>

## Activating the 2D Mode

Set one of xLen, yLen or zLen to zero.

Note, that if you are planning to call setDimensions and plot something afterwards again, set xRes, yRes and zRes again, because the 2D Mode will force the one on the flat axis to be 1. So don't be suprised when nothing shows up.

```js
    plot.setDimensions({xLen:0}) // or yLen:0 or zLen: 0
    plot.plotCsvString(data, 0, 1, 2)
```

<br/>

## Plotting Formulas

```js
    plot.plotFormula("sin(5*x1)*cos(5*x3)")
```

supported keywords/operators (case sensitive):

- sin, cos, tan
- sinh, cosh, tanh
- asin, acos, atan
- log, ln
- e, pi, π
- min, max, abs
- ^, exp, sqrt
- !

<br/>

## Plotting Functions

it is very similar to plotFormula, but in this case you can hand a function over.

```js
    var a = function(a, b) { 
        if(a > 0.5)
            return 1
        return Math.sin(a*5) + Math.sin(b*5);
    }

    plot.plotFunction(a)
```

<br/>

## Animations

Good examples for this are:

- /test/visual_tests/b.html
- /test/visual_tests/f.html
- /test/visual_tests/g.html
- /test/visual_tests/h.html

<br/>

# Help/Contact

Feel free to request help if the documentation, this quick introduction and the examples in /test/visual_tests/ could not help you at proxima@hip70890b.de. I will add the information to this page afterwards.