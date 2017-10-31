# Usage

This is incomplete. Please also take a look at /test/visual_tests/ and open the files in your browser to see which one does roughly that what you are looking for and then inspect the sourcecode. Some of them contain settings that are not needed but only exist to test if the plot breaks or not.

To learn how to navigate and also understand many of the available settings, please open http://hip70890b.de/JsPlot3D_Playground/ in your browser.

Also see the documentation, which you can find here: https://doclets.io/sezanzeb/JsPlot3D/master/overwiew. Click on "API" on the left hand side of the website.

**The first steps for everything here are the following:**

Link the scripts and create an element as container

```html
    <script src="https://threejs.org/build/three.js"></script>
    <script type="text/javascript" src="JsPlot3D.js"></script>
    <div id="foobar"></div>
```

Create a new instance of Plot

```js
    var plot = new JSPLOT3D.Plot(document.getElementById("foobar"))
```

<br/>

## Modes

You can use constants to change the mode

```js
    plot.plotCsvString(data, 0, 1, 2, {
        mode: JSPLOT3D.SCATTERPLOT_MODE
    })
```

As you can see, the fifth parameter of plotCsvString is an object that can contain settings. For a list of all available settings, go to the documentation which is linked above.
The first parameter is a string that contains csv formatted data. The second, third and fourth parameter are the column indices which are used to plot 3D data.

Here are the modes and their values:

```js
    SCATTERPLOT_MODE = "scatterplot"
    BARCHART_MODE = "barchart"
    LINEPLOT_MODE = "lineplot" // works only for data frames or csv data
    POLYGON_MODE = "polygon" // works only for formulas
```

<br/>

## Activating the 2D Mode

Set one of xLen, yLen or zLen to zero

```js
    plot.setDimensions({xLen:0}) // or yLen:0 or zLen: 0
    plot.plotCsvString(data, 0, 1, 2)
```

<br/>

## Displaying Labeled Data

it works with all modes (Except polygon, which is not available outside of plotFormula)

```js
    var data = "x,y,z,label\n"+
               "1;2;3;tree\n"+
               "1;2;4;flower\n"+
               "2;1;5;painting\n"

    plot.plotCsvString(data, 0, 1, 2, {
        labeled: true,
        colorCol: 3,
        header: true
    }
```

<br/>

## Plotting Formulas

```js
    plot.plotFormula("sin(2*x1+i)*sin(2*x3-i)", {
        normalizeX2: false
    })
```

supported keywords/operators:

- sin, cos, tan
- sinh, cosh, tanh
- asin, acos, atan
- log, ln
- e, pi, π
- min, max, abs
- ^, exp, sqrt
- !

## Animations

Good examples for this are:

- /test/visual_tests/b.html
- /test/visual_tests/f.html
- /test/visual_tests/g.html
- /test/visual_tests/h.html

<br/>

# Help/Contact

Feel free to request help if the documentation, this quick introduction and the examples in /test/visual_tests/ could not help you at proxima@hip70890b.de. I will add the information to this page afterwards.