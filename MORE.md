## Building JsPlot3D.js

You need to install npm first. It comes bundled with node.js

https://nodejs.org/en/download/

afterwards:

    npm install
    npm start

For an unminified file, remove the -p parameter from package.json 

    "start": "webpack"

minified:

    "start": "webpack -p"

JsPlot3D.js is now created in compiled/JsPlot3D.js


## How to Use

first, you need to build. See above.
    
JsPlot3D.js will then be created in compiled/ automatically
    
Take a look into the sourcode of the files in test/. There are a few examples that show what you can do with this tool.

The live example can also help you to understand the parameters: http://hip70890b.de/JsPlot3D_Playground/



## Todo

**new modes:**

- in case zLen == 0 or zRes <= 1, enter a **2D mode**. In that mode the camera is orthographic and can only be moved in y and x direction. Remove the zAxis line, arrow ,numbers (which are yet to implement) and letter. Move the axes to the front, so that they don't get hidden beneath bars. Do the same for y and x. When y is flat, enter a view-from-top mode. In "appearance" below there is a todo entry about adding numbers to the axis. Those two would work well together. The view-from-top mode would look especially good in barchart mode, you would get some sort of pixelated heatmap image out of the data.
- add an **isometric ortographic camera mode**
- csvplot: add **a mode called "wire"**. Instead of sprites, connect each datapoint to a wire that goes through all the points, from the first point in the dataframe to the last

**appearance:**

- in barchart mode add **numbers to the axes** that match the barchart-grid
- add numbers to the axes tips indicating the maximum value
- display box around the plot that has inverse culling, so that the viewer can look inside it. Display a grid texture on it's faces. (not sure how to do this in a way that would look good. Maybe it would not be only a box but rather **a 3D grid divides the complete 3D-space into small cubes**.
- calculate the **average color per bar** (which are sums of y values that are near that grid position) depending on colorCol. At the moment it only dyes according to the y-height
- heatmapcolor it according to function height (for polygons)

**user experience:**

- support **writing the colum header name as x1col x2col x3col and colorCol**
- arrange the live example settings in a more clean way

**performance and code quality:**

- how is the performance for very large dataframes?
- increase barchart performance. e.g. by adding the option to define the normalization ranges (min and max) yourself (so that the tool does not have to calculate it on its own), and also when plotting formulas, data gets transformed to a dataframe and then transformed to a "x,z -> y" kind of 2D array, maybe there is a way to just directly calculate the 2D array, hand it over to PlotDataFrame, which then ignores the df variable.
- add a module that handles the creation of dataframes from other data formats, which would help to clean up src/JsPlot3D.js a little

**experimental:**

- for recursive formulas use the scatterplot mode by default
- for recursive formulas, offer some start value setter
- maybe there is some way of creating a polygon from unevenly distributed datapoints. (imagine an island floating somewhere that is made up of datapoints and then connect that to a mesh). So that geographic height data could be displayed.
- creating 3D meshes from labeled data that encapsulate the whole group/cluster


## Documentation

Currently there is a documentation here: https://doclets.io/sezanzeb/JsPlot3D/master/overwiew


## Attribution

iris.csv Dataset by Ronald Fisher

Codystar font by Neapolitan Principal design https://fonts.google.com/specimen/Codystar, released under the Open Font License
