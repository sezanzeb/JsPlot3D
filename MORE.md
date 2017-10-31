## Building JsPlot3D.js

You need to install npm first. It comes bundled with node.js

https://nodejs.org/en/download/

afterwards:

    npm install
    npm start

For an unminified file (to be able to use the browser debugger):

    npm test

JsPlot3D.js is now created in compiled/JsPlot3D.js


## Testing

go to test/index.html


## How to Use

see USAGE.md



## Todo

**Very Important:**

- be vault tollerant for user input, but not for internal code. use === and !==, don't check everything for == undefined, if it has to be there, assume it is there, if not, fix the bug

**user experience:**

- support writing the colum header name as x1col x2col x3col and colorCol
- arrange the live example settings in a more clean way
- make a quick tutorial for the live example when v1.0 is about to be released

**performance and code quality:**

- how is the performance for very large dataframes?
- add a module that handles the creation of dataframes from other data formats, which would help to clean up src/JsPlot3D.js a little
- move code out of JsPlot3D.js into modules
- make a module that returns min and max values for standard cases
- move normalization code into the modules in src/plotModes/*.js. (The x2 normalization in src/plotModes/Barchart.js is already there)

**experimental:**

- for recursive formulas use the scatterplot mode by default
- for recursive formulas, offer some start value setter
- maybe there is some way of creating a polygon from unevenly distributed datapoints. (imagine an island floating somewhere that is made up of datapoints and then connect that to a mesh). So that geographic height data could be displayed.
- creating 3D meshes from labeled data that encapsulate the whole group/cluster


## Documentation

Currently there is a documentation here: https://doclets.io/sezanzeb/JsPlot3D/master/overwiew

And a little HowTo can be found in USAGE.md


## Attribution

https://fontlibrary.org/en/font/retroscape by Robert Jablonski (public domain)
