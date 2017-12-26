## Building JsPlot3D.js

You need to install npm first. It comes bundled with node.js

https://nodejs.org/en/download/

afterwards:

**Building JsPlot3D.js**

    npm install
    npm start
    
**for a non-minified version:**

    npm install
    npm test

JsPlot3D.js is now created in compiled/JsPlot3D.js


## Testing

go to test/index.html


## How to Use

see USAGE.md



## Todo

**user experience:**

- support writing the colum header name as x1col x2col x3col and colorCol
- arrange the live example settings in a more clean way
- make a quick tutorial for the live example when v1.0 is about to be released

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

https://commons.wikimedia.org/wiki/File:Heightmap.png by A3r0 (public domain)