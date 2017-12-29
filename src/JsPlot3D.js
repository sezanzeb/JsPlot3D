/**
 * Plots Dataframes and Formulas into a 3D Space
 * @module JsPlot3D
 */

// IMPORTS

// three.js is not yet needed in this file
import SceneHelper from "./SceneHelper.js"
import scatterplot from "./plotModes/Scatterplot.js"
import lineplot from "./plotModes/Lineplot.js"
import barchart from "./plotModes/Barchart.js"
import polygon from "./plotModes/Polygon.js"
import selforganizingmap from "./plotModes/selforganizingmap.js"
import interpolatedpolygon from "./plotModes/interpolatedpolygon"
import * as COLORLIB from "./ColorLib.js"


// CONSTANTS
export const XAXIS = 1
export const YAXIS = 2
export const ZAXIS = 3
export const SCATTERPLOT_MODE = "scatterplot"
export const BARCHART_MODE = "barchart"
export const LINEPLOT_MODE = "lineplot"
export const POLYGON_MODE = "polygon"
export const SOM_MODE = "selforganizingmap"
export const DEFAULTCAMERA = 0
export const TOPCAMERA = 1
export const LEFTCAMERA = 2
export const FRONTCAMERA = 3
export { COLORLIB } // so that the jasmine tests can have access to the imported libs as JSPLOT3D.COLORLIB


// Main Class for this Tool, exported as JSPLOT3D.Plot
export class Plot
{
    /**
     * Creates a Plot instance, so that a single canvas can be rendered. After calling this constructor, rendering can
     * be done using plotFormula(s), plotCsvString(s) or plotDataFrame(df)
     * @param {object} container html/div/DOM element. Inside that container a canvas is created
     *                           - Example: document.getElementById("foobar"); // with foobar being the html id of the container.
     * @param {json} sceneOptions optional. at least one of backgroundColor or axesColor in a Json Format {}. Colors can be hex values "#123abc" or 0x123abc, rgb and hsl (e.g. "rgb(0.3,0.7,0.1)")
     *                            - Example: {backgroundColor: "#123abc", axesColor: 0x123abc}
     */
    constructor(container, sceneOptions ={})
    {
        
        // parameter typechecks
        if(typeof(container) != "object")
            return console.error("second param for the Plot constructor (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")

        // The order of the following tasks is important!

        // initialize oldData object. The cache/oldData is used for faster rerendering of similar
        // datasets and to remember some parameters, for example when addDataPoint is called.
        this.clearOldData()

        // scene helper is needed for setContainer, because in setContainer the sceneHelper is told to set the size to the container. (could also be implemented in a different way ofc)
        // the scene helper basically takes care of a lot of three.js stuff
        this.SceneHelper = new SceneHelper({width: container.offsetWidth, height: container.offsetHeight})

        // first set up the container and the dimensions
        this.setContainer(container)
        // don't use setDimensions for the following, as setDimensions is meant
        // to be something to call during runtime and will cause problems in this case
        this.dimensions = {xRes:20, zRes:20, xLen:1, yLen:1, zLen:1}

        // then setup the children of the scene (camera, light, axes)
        this.SceneHelper.createScene(this.dimensions, sceneOptions, {width: container.offsetWidth, height: container.offsetHeight})
        this.SceneHelper.centerCamera(this.dimensions) // set camera position

        // initialize the legend variables
        this.initializeLegend()

        // by default disable the benchmark process
        this.benchmark = {}
        this.benchmark.enabled = false
        this.benchmark.recentTime = 0

        // start empty
        this.plotmesh = null

        // no animation by default
        this.animationFunc = null

        // to trigger rendering every four frames. +1 % 4, do something if it equals 0. At first needs to be 0, so that stuff renders.
        // it is incremented in this.callAnimation
        this.fps15 = 0

        // now render the empty space (axes will be visible, because of SceneHelper.createScene)
        this.SceneHelper.render()
    }




    /**
     * plots a formula into the container as 3D Plot. **Please make sure to link mathjs in your html head** or do it by using plotFunction
     * @param {string} formula string of formula. example: sin(x1) + x3
     * @param {object} variables when formula is something like "x1 + i", use {"i": 2} for example as variables parameter
     * - default: {}
     * - null and undefined will be interpreted as "use default"
     * @param {object} options this is the same as in plotFunction
     */
    plotFormula(formula, variables={}, options={})
    {
        if(typeof(math) == "undefined") // eslint-disable-line no-undef
        {
            console.error("mathjs was not found. Link the script in your html file http://mathjs.org/download.html")
            console.error("or use plotFunction(function(x1, x3) { return x1+x3; }) for example")
            return
        }

        if(variables == null)
        {
            variables = {}
        }

        let compiled = math.compile(formula) // eslint-disable-line no-undef
        this.plotFunction(function(x1, x3)
        {
            variables.x1 = x1
            variables.x3 = x3
            return compiled.eval(variables)
        }, options)
    }



    /**
     * Instead of passing one single array of data, you can select three different arrays. X[n], Y[n], Z[n] is treated as the n-th datapoint.
     * labels[n] is the label of this datapoint, that is used for coloration. All those 4 arrays should have the same length. Only as many points can
     * be plotted as the shortest array's length.
     * @param {number} X Array of X-Values [1, 2, 0.6, 3]
     * @param {number} Y Array of Y-Values []
     * @param {number} Z 
     * @param {number} labels Array of labels, e.g. ["Tree", "Bird", "Fox", "Fox", "Dog", "Tree"] or [1, 2, 3, 1, 2, 2, 1].
     * - When this parameter is defined, the default value of options.colorCol is set to the column of labels (3).
     * But it can also be overwritten to one of 0, 1 or 2 by using the options parameter
     * - Default: null
     * @param {object} options same as the options parameter in plotDataFrame
     */
    plotArrays(X, Y, Z, labels=null, options={})
    {
        // how many datapoints
        let length = Math.min(X.length, Y.length, Z.length)

        // this is going to be filled with datapoints
        // TODO new Float32Array when the array contains integers (see GitHub issue #16, might contain strings at some point in the future)
        let df = new Array(length)

        // how many attributes(x, y, z and maybe labels) each datapoint has
        let attributes = 3

        if(labels !== null)
        {
            // if labels is defined, assume that as colorCol and add it to the dataframe
            length = Math.min(length, labels.length)
            if(options.colorCol === undefined) options.colorCol = 3
            attributes = 4
        }

        // TODO I wonder if this is faster when using webassembly?
        // transpose [X, Y, Z]
        for(let i = 0; i < length; i++)
        {
            df[i] = new Array(attributes)
            df[i][0] = X[i]
            df[i][1] = Y[i]
            df[i][2] = Z[i]
        }

        // add the labels
        for(let i = 0; i < length; i++)
        {
            df[i][3] = labels[i]
        }

        this.plotDataFrame(df, 0, 1, 2, options)
    }



    /**
     * plots a function into the container as 3D Plot. It will execute the function with varying parameters a few times
     * @param {function} foo function. For example: function(x, z) { return x+z }
     * @param {object} options json object with one or more of the following parameters:
     * - mode {string}: "barchart", "scatterplot" or "polygon"
     * - normalizeX2 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X2 Axis (y)
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]. will be overwritten if normalization is on
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.04
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateOldData {boolean}: if false, don't overwrite the dataframe that is stored in the oldData-object
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0  
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */
    plotFunction(foo, options ={})
    {
        // default options
        let mode = POLYGON_MODE
        let x2frac = 1
        let normalizeX2 = true
        let title = "function"
        let x1title = "1. param"
        let x2title = "return value"
        let x3title = "2. param"

        if(this.isAnimated())
            options.fastForward = true // performance increase by using fastForward (but it's only very small actually)

        // overwrite if available
        if(options.mode != undefined) mode = options.mode
        if(options.x2frac != undefined) x2frac = options.x2frac
        if(options.normalizeX2 != undefined) normalizeX2 = options.normalizeX2
        if(options.title != undefined) title = options.title
        if(options.x1title != undefined) x1title = options.x1title
        if(options.x2title != undefined) x2title = options.x2title
        if(options.x3title != undefined) x3title = options.x3title

        if(!foo)
            return console.error("first param of plotFormula (foo) is undefined or empty")

        // so that plotCsvString knows that the dataFrame did not originate from plotCsvString
        this.clearCheckString()

        // force the following settings:
        options.header = false

        // the deafult titles here are different from plotDataFrame, which is being called later to actually show the formula. So the default titles
        // need to be passed to plotDataFrame inside the options object. Or of course the user has set them in the options parameter. in That case those variables
        // contain the user setting.
        options.title = title
        options.x1title = x1title
        options.x2title = x2title
        options.x3title = x3title

        if(mode == POLYGON_MODE)
        {

            //plotFunction
            //-------------------------//
            //         Polygon         //
            //-------------------------//
    
            // indicates, that a polygon is currently being plotted, which also indicates that a formula is being plotted
            this.oldData.options.mode = POLYGON_MODE

            let hueOffset = 0
            let numberDensity = 3

            if(this.checkNumber("hueOffset", options.hueOffset)) hueOffset = options.hueOffset
            if(this.checkNumber("numberDensity", options.numberDensity)) numberDensity = options.numberDensity

            let colors = {hueOffset}
            let normalization = {normalizeX2, x2frac}
            let appearance = {numberDensity}
            let dimensions = this.dimensions

            // creating the legend. As this polygon mode does not forward a dataframe to plotDataFrame, creating the legend has to be handled here in plotFormula
            this.populateLegend({x1title, x2title, x3title, title})

            // the y-values are calculated inside the call to polygon, so no df is passed over to this function
            // note that updating the numbers along the axes is handled in the call to polygon
            polygon(foo, this, colors, normalization, appearance, dimensions)

        }
        else
        {
            //plotFunction
            //-------------------------//
            //     default action      //
            //-------------------------//

            // mode unrecognized, maybe plotDataFrame knows what to do
            // create a dataframe and send it to plotDataFrame
            // multiply those two values for the ArraySize because that many datapoints will be created
            let df = new Array(this.dimensions.xRes * this.dimensions.zRes)

            // three values (x, y and z) that are going to be stored in the dataframe

            // line number in the new dataframe
            let i = 0
            let y = 0

            for(let x = 0; x < this.dimensions.xRes; x++)
            {
                for(let z = 0; z < this.dimensions.zRes; z++)
                {
                    // calculate y. y = f(x1, x2)
                    y = foo(x/this.dimensions.xRes, z/this.dimensions.zRes)

                    df[i] = new Float32Array(3)
                    df[i][0] = x/this.dimensions.xRes // store the datapoint
                    df[i][1] = y // store the datapoint
                    df[i][2] = z/this.dimensions.zRes // store the datapoint

                    i++
                }
            }

            // colorCol is the index that is used to colorate the datapoints.
            // The index of 1 means the y value contains the number that is converted to a color
            options.colorCol = 1 // it is 1 because of "df[i][1] = y" above

            // continue plotting this DataFrame
            this.plotDataFrame(df, 0, 1, 2, options)
        }
    }



    /**
     * plots a .csv string into the container as 3D Plot according to the configuration.
     * @param {string} sCsv string of the .csv file, e.g."a;b;c\n1;2;3\n2;3;4"
     * @param {number} x1col column index used for transforming the x1 axis (x). default: 0
     * @param {number} x2col column index used for transforming the x2 axis (y). default: 1
     * @param {number} x3col column index used for plotting the x3 axis (z). default: 2
     * @param {object} options json object with one or more of the following parameters:
     * - csvIsInGoodShape {boolean}: true if the .csv file is in a good shape. No quotation marks around numbers, no leading and ending whitespaces, no broken numbers (0.123b8),
     * all lines have the same number of columns. true results in more performance. Default: false. If false, the function will try to fix it as good as it can.
     * - separator {string}: separator used in the .csv file. e.g.: "," or ";" as in 1,2,3 or 1;2;3
     * - mode {string}: "barchart" or "scatterplot"
     * - header {boolean}: a boolean value whether or not there are headers in the first row of the csv file. Default true
     * - colorCol {number}: leave undefined or set to -1, if defaultColor should be applied. Otherwise the index of the csv column that contains color information.
     * (0, 1, 2 etc.). Formats of the column within the .csv file allowed:
     * numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically.
     * Integers that are used as class for labeled data would result in various different hues in the same way.
     * hex strings ("#f8e2b9"). "rgb(...)" strings. "hsl(...)" strings. strings as labels (make sure to set labeled = true).
     * - normalizeX1 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X1 Axis
     * - normalizeX2 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X2 Axis (y)
     * - normalizeX3 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X3 Axis
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - labeled {boolean}: true if colorCol contains labels (such as 0, 1, 2 or frog, cat, dog). This changes the way it is colored.
     * Having it false on string-labeled data will throw a warning, but it will continue as it was true
     * - defaultColor {number or string}: examples: #1a3b5c, 0xfe629a, rgb(0.1,0.2,0.3), hsl(0.4,0.5,0.6). Gets applied when either colorCol is -1, undefined or ""
     * - x1frac {number}: by how much to divide the datapoints x1 value to fit into [-1;1]. will be overwritten if normalization is on
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]. will be overwritten if normalization is on
     * - x3frac {number}: by how much to divide the datapoints x3 value to fit into [-1;1]. will be overwritten if normalization is on
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.04
     * - filterColor {boolean}: false: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then and not filtered to a heatmap). Default true, which filters it to a heatmap
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateOldData {boolean}: if false, don't overwrite the dataframe that is stored in the oldData-object
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */
    plotCsvString(sCsv, x1col=0, x2col=1, x3col=2, options={})
    {
        //---------------------------//
        //  parameter type checking  //
        //---------------------------//

        // a more complete checking will be done in plotDataFrame once the dataframe is generated.
        // only check what is needed in plotCsvString
        
        if(sCsv === "" || !sCsv)
        {
            return console.error("dataframe arrived empty")
        }

        if(typeof sCsv !== "string")
        {
            return console.error("the value of the first parameter of plotCsvString is not a string, but it has to be a string in the "+
                                 "shape of a .csv file. If you are looking for a way to plot an array, please take a look at plotDataFrame")
        }

        // default config
        let separator = ","
        let title = ""
        let fraction = 1
        let csvIsInGoodShape = false
        let header = true

        // check variables. Overwrite if it's good. If not, default value will remain
        if(this.checkNumber("fraction", options.fraction)) fraction = options.fraction
        if(this.checkBoolean("csvIsInGoodShape", options.csvIsInGoodShape)) csvIsInGoodShape = options.csvIsInGoodShape
        if(this.checkBoolean("header", options.header)) header = options.header

        // check everything else
        if(options.separator != undefined)
            separator = options.separator
        if(options.title != undefined)
            title = options.title

        this.benchmarkStamp("start")

        //plotCsvString
        //-------------------------//
        //         caching         //
        //-------------------------//

        // still the same data?
        // create a very quick checksum sort of string
        let stepsize = (sCsv.length/20)+1|0
        let samples = ""

        for(let i = 0;i < sCsv.length; i+= stepsize)
        {
            samples = samples + sCsv[i]
        }

        // take everything into account that changes how the dataframe looks after the processing
        let checkstring = (title+sCsv.length+samples+fraction+separator).replace(/[\s\t\n\r]/g,"_")

        // now check if the checksum changed. If yes, remake the dataframe from the input
        // and also check if oldData even contains any data to make it more failsafe
        if(this.oldData.checkstring != checkstring || this.oldData.dataframe.length == 0)
        {
            
            //plotCsvString
            //-------------------------//
            //       creating df       //
            //-------------------------//
            // and caching it afterwards

            // new csv arrived:

            // transform the sCsv string to a dataframe
            let data = sCsv.split(/[\n\r]+/g)

            if(data[0].trim() === "") // to prevent an error I have encountered when reading a csv from DOM Element innerHTML.
            // This probably happens when the csv data starts one line below the opening bracket of the Element
                data = data.slice(-(data.length-1))
            if(data[data.length-1].trim() === "")
                data.pop()

            // now check if the dataframe is empty
            if(data.length === 0)
                return console.error("dataframe is empty")
                
            if(fraction < 1)
            {                    
                data = data.slice(0, Math.max(Math.min(3,data.length),data.length*fraction))
            }

            // find out the separator automatically if the user didn't define it
            if(options.separator === undefined || data[0].indexOf(separator) === -1)
            {
                // in case of undefined or -1, assume ;
                separator = ";"

                if(data[0].indexOf(separator) === -1)
                    separator = ","

                // tabbed data. either a combination of whitespaces and tabs, mutliple whitespaces (at least 2) or at least one tab
                // ?: will not capture the group
                if(data[0].indexOf(separator) === -1)
                    separator = /(?:[\s\t]{2,}|\t+)/g

                if(data[0].search(separator) === -1)
                    return console.error("no csv separator/delimiter was detected. Please set separator:\"...\" according to your file format: \""+data[0]+"\"")


                console.warn("the specified separator/delimiter was not found. Tried to detect it and came up with \""+separator+"\". Please set separator =\"...\" according to your file format: \""+data[0]+"\"")
            }

            // header auto detection
            if(options.header == undefined)
            {
                // split first line and check if it consists of numbers
                let firstline = data[0].split(separator)
                if(isNaN(parseFloat(firstline[x1col])) || isNaN(parseFloat(firstline[x2col])) || isNaN(parseFloat(firstline[x3col])))
                {
                    console.warn("detected headers")
                    options.header = true
                    header = true
                }
                else
                {
                    options.header = false
                    header = false
                }
            }

            if(!csvIsInGoodShape)
            {
                // check 5% of the columns to get the highest number of columns available (if not unlucky)
                let columnCount = 0
                for(let i = 0;i < Math.min(data.length, data.length*0.05+10);i++)
                {
                    columnCount = Math.max(columnCount, data[i].split(separator).length)
                }

                for(let line = 0;line < data.length; line ++)
                {
                    // remove leading and ending whitespaces in data
                    data[line] = data[line].trim().split(separator)
                    
                    // make sure every row has the same number of columns
                    data[line] = data[line].slice(0, columnCount)
                    data[line] = data[line].concat(new Array(columnCount-data[line].length))

                    for(let col = 0;col < data[line].length; col++)
                    {

                        // make sure every column has stored a value. if not (maybe because of faulty csv formats), assume 0
                        if(data[line][col] == undefined) // check for undefined, because slice might create some empty fields if csv is very broken
                        {
                            data[line][col] = 0
                        }
                        else
                        {
                            // remove quotation marks "bla";"1";"2"
                            if(data[line][col][0] === "\"")
                            {
                                if(data[line][col][data[line][col].length-1] === "\"")
                                {
                                    data[line][col] = data[line][col].slice(1,-1)
                                }
                            }

                            // don't assume that all lines have the same format when looking at the same column
                            // that means every cell has to be parsed
                                
                            // parse if possible. if not leave it as it is
                            let parsed = parseFloat(data[line][col])
                            if(!isNaN(parsed))
                            {
                                data[line][col] = parsed // number
                            }
                            // check if the recent line was a number. if "", assume 0 then
                            else if(data[line][col] === "" && typeof data[line-1][col] === "number")
                            {
                                data[line][col] = 0
                            }
                            else
                            {
                                data[line][col].trim() // string
                            }
                        }
                    }
                }
            }
            else
            {
                // The user trusts the csv and wants maximum performance
                // that means: no quotation marks and all rows have the same number of columns and contain the same datatypes

                // important for the script because it has, even if csvIsInGoodShape, to check the datatype of the column values
                let startLine = 0
                if(header)
                    startLine = 1

                // split lines into columns
                for(let line = 0;line < data.length; line ++)
                    data[line] = data[line].split(separator)

                // iterate over columns
                for(let col = 0;col < data[0].length; col++)
                {
                    // check if that column can be parsed
                    if(!isNaN(parseFloat(data[startLine][col]))) // if parsable as number 
                        for(let line = 0;line < data.length; line ++) // continue like so for all following datapoints/rows/lines without checking again
                            data[line][col] = parseFloat(data[line][col])
                }
            }

            // If the same dataframe is used next time, don't parse it again
            // this.oldData.dataframe = data // don't do that, the dataframe is being stored in oldData at a later point. don't store it now, if it can't be considered 'old' at the moment
            this.oldData.checkstring = checkstring

            this.benchmarkStamp("created the dataframe and cached it")

            // plot the dataframe.
            options.fraction = 1 // Fraction is now 1, because the fraction has already been taken into account

            this.plotDataFrame(data, x1col, x2col, x3col, options)
        }
        else
        {
            console.log("using cached dataframe")
            // cached
            // this.oldData != undefined and checkstring is the same
            // same data. Fraction is now 1, because the fraction has already been taken into account
            this.plotDataFrame(this.oldData.dataframe, x1col, x2col, x3col, options)
        }
    }



    /**
     * plots a dataframe on the canvas element which was defined in the constructor of Plot()
     * @param {number[][]} df int[][] of datapoints. [row][column]
     * @param {number} x1col column index used for transforming the x1 axis (x). default: 0
     * @param {number} x2col column index used for transforming the x2 axis (y). default: 1
     * @param {number} x3col column index used for plotting the x3 axis (z). default: 2
     * @param {object} options json object with one or more of the following parameters:
     * - mode {string}: "barchart", "scatterplot" or "lineplot"
     * - header {boolean}: a boolean value whether or not there are headers in the first row of the csv file. Default true
     * - colorCol {number}: leave undefined or set to -1, if defaultColor should be applied. Otherwise the index of the csv column that contains color information.
     * (0, 1, 2 etc.). Formats of the column within the .csv file allowed:
     * numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically.
     * Integers that are used as class for labeled data would result in various different hues in the same way.
     * hex strings ("#f8e2b9"). "rgb(...)" strings. "hsl(...)" strings. strings as labels (make sure to set labeled = true).
     * - normalizeX1 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X1 Axis
     * - normalizeX2 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X2 Axis (y)
     * - normalizeX3 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X3 Axis
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - labeled {boolean}: true if colorCol contains labels (such as 0, 1, 2 or frog, cat, dog). This changes the way it is colored.
     * Having it false on string-labeled data will throw a warning, but it will continue as it was true
     * - defaultColor {number or string}: examples: #1a3b5c, 0xfe629a, rgb(0.1,0.2,0.3), hsl(0.4,0.5,0.6). Gets applied when either colorCol is -1, undefined or ""
     * - x1frac {number}: by how much to divide the datapoints x1 value to fit into [-1;1]. will be overwritten if normalization is on
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]. will be overwritten if normalization is on
     * - x3frac {number}: by how much to divide the datapoints x3 value to fit into [-1;1]. will be overwritten if normalization is on
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.04
     * - filterColor {boolean}: false: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then and not filtered to a heatmap). Default true, which filters it to a heatmap
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateOldData {boolean}: if false, don't overwrite the dataframe that is stored in the oldData-object
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */      
    plotDataFrame(df, x1col = 0, x2col = 1, x3col = 2, options={})
    {
        // to optimize for performance, use:
        // {
        //   colorCol: -1 // don't calculate heatmaps
        //   defaultColor: 0xff6600 // whatever you like
        //   normalizeX1: false
        //   normalizeX2: false
        //   normalizeX3: false
        //   updateOldData: true // in addDataPoint this is automatically false, otherwise the oldData-object would be overwritten with a single point
        //   fraction: 0.5 // don't plot everything
        // }
        this.benchmarkStamp("plotDataFrame starts")
        //---------------------------//
        //  parameter type checking  //
        //---------------------------//
        // default config
        let header = true
        let colorCol =-1
        let mode = SCATTERPLOT_MODE
        let normalizeX1 = true
        let normalizeX2 = true
        let normalizeX3 = true
        let title = ""
        let fraction = 1
        let labeled = false
        let defaultColor = 0 // black
        let barchartPadding = 0.5
        let dataPointSize = 0.04
        let filterColor = true
        let x1title = "x1"
        let x2title = "x2"
        let x3title = "x3"
        let hueOffset = 0
        let keepOldPlot = false
        let updateOldData = true
        let barSizeThreshold = 0
        let x1frac = 1 // TODO i think it would be ok to remove them and make the individual plotmodes create them themselfes
        let x2frac = 1 // that would make the code here a little bit cleaner
        let x3frac = 1
        let numberDensity = 3


        // fastforward the following in case of addDataPoint or something to increase animation performance
        // if(optoins.variable1) variable1 = options.variable1
        // if(optoins.variable2) variable2 = options.variable2
        // ...
        let headerRow 
        if(!options.fastForward) // if not undefined or false
        {
            // seems like the user sent some parameters. check them

            // treat empty strings as if it was undefined in those cases:
            if(options.colorCol === "") options.colorCol = undefined

            // check numbers. Overwrite if it's good. If not, default value will remain
            if(options.colorCol != undefined && options.colorCol >= df[0].length)
            {
                console.error("column with index "+options.colorCol+", used as colorCol, is not existant in the dataframe. Disabling coloration")
                options.colorCol = -1
            }

            if(this.checkNumber("fraction", options.fraction)) fraction = options.fraction
            if(this.checkNumber("barchartPadding", options.barchartPadding)) barchartPadding = options.barchartPadding
            if(this.checkNumber("hueOffset", options.hueOffset)) hueOffset = options.hueOffset
            if(this.checkNumber("numberDensity", options.numberDensity)) numberDensity = options.numberDensity
            if(this.checkNumber("x1frac", options.x1frac)) x1frac = options.x1frac
            if(this.checkNumber("x2frac", options.x2frac)) x2frac = options.x2frac
            if(this.checkNumber("x3frac", options.x3frac)) x3frac = options.x3frac
            if(this.checkNumber("colorCol", options.colorCol)) colorCol = options.colorCol
            if(this.checkNumber("dataPointSize", options.dataPointSize)) dataPointSize = options.dataPointSize
            if(this.checkNumber("barSizeThreshold", options.barSizeThreshold)) barSizeThreshold = options.barSizeThreshold
            
            if(dataPointSize <= 0)
                console.error("datapoint size is <= 0. Datapoints will be invisible in scatterplot and lineplot modes")

            if(barchartPadding >= 1 || barchartPadding < 0)
            {
                barchartPadding = 0
                console.error("barchartPadding is invalid. maximum of 1 and minimum of 0 accepted. Now continuing with barchartPadding = "+barchartPadding)
            }

            // check booleans. Overwrite if it's good. If not, default value will remain
            if(this.checkBoolean("labeled", options.labeled)) labeled = options.labeled
            if(this.checkBoolean("normalizeX1", options.normalizeX1)) normalizeX1 = options.normalizeX1
            if(this.checkBoolean("normalizeX2", options.normalizeX2)) normalizeX2 = options.normalizeX2
            if(this.checkBoolean("normalizeX3", options.normalizeX3)) normalizeX3 = options.normalizeX3
            if(this.checkBoolean("header", options.header)) header = options.header
            if(this.checkBoolean("filterColor", options.filterColor)) filterColor = options.filterColor
            if(this.checkBoolean("keepOldPlot", options.keepOldPlot)) keepOldPlot = options.keepOldPlot
            if(this.checkBoolean("updateOldData", options.updateOldData)) updateOldData = options.updateOldData

            // check everything else
            if(options.title != undefined) title = options.title
            if(options.defaultColor != undefined) defaultColor = options.defaultColor
            if(options.mode != undefined) mode = options.mode
            if(options.x1title != undefined) x1title = options.x1title
            if(options.x2title != undefined) x2title = options.x2title
            if(options.x3title != undefined) x3title = options.x3title

            if(!this.checkNumber("x1col", x1col)) x1col = Math.min(0, df[0].length-1)
            if(!this.checkNumber("x2col", x2col)) x2col = Math.min(1, df[0].length-1)
            if(!this.checkNumber("x3col", x3col)) x3col = Math.min(2, df[0].length-1)
            
            //>= because comparing indices with numbers
            if(x1col >= df[0].length || x2col >= df[0].length || x3col >= df[0].length)
            {
                console.error("one of the colum indices is out of bounds. The maximum index in this dataframe is "+(df[0].length-1)+". x1col: "+x1col+" x2col:"+x2col+" x3col:"+x3col)
                // detct the rightmost column index that contains numberes
                let maximumColumn = 2 // to match the default settings of 0, 1 and 2, start at 2
                let line = 0
    
                if(df[1] != undefined) // if possible try to skip the first line, because it might contain a header
                    line = 1
    
                for(;maximumColumn >= 0; maximumColumn--)
                    if(!isNaN((df[line][maximumColumn])))
                        break
    
                x1col = Math.min(x1col, maximumColumn)
                x2col = Math.min(x2col, maximumColumn)
                x3col = Math.min(x3col, maximumColumn)
            }
            
            // header auto detection
            if(options.header == undefined)
            {
                if(typeof(df[0][x1col]) != "number" || typeof(df[0][x2col]) != "number" || typeof(df[0][x3col]) != "number")
                {
                    console.warn("detected headers")
                    header = true
                }
                else
                {
                    header = false
                }
            }
            
            if(fraction < 1)
            {
                // at least 3 rows if possible to support headers and two distinct datapoints
                df = df.slice(0, Math.max(Math.min(3,df.length),df.length*fraction))
            }
            
            if(header)
            {
                if(df.length === 1)
                    return console.error("dataframe is empty besides headers")
    
                headerRow = df[0]
                // still set to default values?
                if(x1title === "x1") x1title = ""+headerRow[x1col]
                if(x2title === "x2") x2title = ""+headerRow[x2col]
                if(x3title === "x3") x3title = ""+headerRow[x3col]
                // remove the header from the dataframe. Usually you would just change the starting pointer for
                // the array. don't know if something like that exists in javascript
                df = df.slice(1, df.length)
            }
            
            // after all the modifying, is the dataframe still present?
            if(df.length === 0)
                return console.error("dataframe is empty")
        }
        else
        {
            // options.fastForward is true, better performance
            if(options.fraction != undefined) fraction = options.fraction
            if(options.barchartPadding != undefined) barchartPadding = options.barchartPadding
            if(options.hueOffset != undefined) hueOffset = options.hueOffset
            if(options.numberDensity != undefined) numberDensity = options.numberDensity
            if(options.x1frac != undefined) x1frac = options.x1frac
            if(options.x2frac != undefined) x2frac = options.x2frac
            if(options.x3frac != undefined) x3frac = options.x3frac
            if(options.colorCol != undefined) colorCol = options.colorCol
            if(options.dataPointSize != undefined) dataPointSize = options.dataPointSize
            if(options.barSizeThreshold != undefined) barSizeThreshold = options.barSizeThreshold
            if(options.labeled != undefined) labeled = options.labeled
            if(options.normalizeX1 != undefined) normalizeX1 = options.normalizeX1
            if(options.normalizeX2 != undefined) normalizeX2 = options.normalizeX2
            if(options.normalizeX3 != undefined) normalizeX3 = options.normalizeX3
            if(options.header != undefined) header = options.header
            if(options.filterColor != undefined) filterColor = options.filterColor
            if(options.keepOldPlot != undefined) keepOldPlot = options.keepOldPlot
            if(options.updateOldData != undefined) updateOldData = options.updateOldData
            if(options.title != undefined) title = options.title
            if(options.defaultColor != undefined) defaultColor = options.defaultColor
            if(options.mode != undefined) mode = options.mode
            if(options.x1title != undefined) x1title = options.x1title
            if(options.x2title != undefined) x2title = options.x2title
            if(options.x3title != undefined) x3title = options.x3title 
            
            if(fraction < 1)
            {
                df = df.slice(0, df.length*fraction)
            }          
        }

        this.benchmarkStamp("checked Parameters")




        // only for scatterplot relevant at the moment. Going to be called when the mode is detected as scatterplot

        // plotDataFrame
        //-------------------------//
        //     coloring labels     //
        //-------------------------//
        // creates an array "dfColors" that holds the color information
        //(unnormalized numbers or color strings (#fff, rgb, hsl)) for each vertex (by index)

        // headers are already removed from df by now

        // if this plot is not adding something to an existing plot, don't pass old labels to getColorMap
        if(!keepOldPlot)
        {
            this.oldData.labelColorMap = {}
            this.oldData.numberOfLabels = 0
        }

        let colorMap, dfColors
        // no animation 15fps reduction here, as this has to happen for every new datapoint
        if(mode !== BARCHART_MODE || labeled) // barcharts can be labeled aswell. if labeled true, get the color map for that.
        {
            colorMap = COLORLIB.getColorMap(df, colorCol, defaultColor, labeled, header, filterColor, hueOffset, this.oldData.labelColorMap, this.oldData.numberOfLabels)
            dfColors = colorMap.dfColors
            this.oldData.labelColorMap = colorMap.labelColorMap
            this.oldData.numberOfLabels = colorMap.numberOfLabels
        }

        // display information about the labels
        this.populateLegend({colorMap, x1title, x2title, x3title, title})

        // by this point only dfColors stays relevant. So the function above can be easily moved to a different class to clear up the code here





        // plotDataFrame
        //-------------------------//
        //       normalizing       //
        //-------------------------//
        // EDIT moved most parts of the normalization to the files in ./plotModes/ and ./NormalizationLib.js

        // finds out by how much the values (as well as colors) to divide and for the colors also a displacement

        // minX1, maxX2, etc. are being loaded from the oldData object. They initially have 0 values
        // so they are zero now
        // then the dataframe gets analyzed (if enabled) and the min and max values are updated

        // if it is disabled, the old values from the oldData object are not updated. this is the default case for addDataPoint.
        // that means new datapoint might be so far away from the initial plot that they cannot be seen anymore, because it gets scaled according to the old normalization information
        // if the values of that datapoint are so ridiculously large compared to the initial plot
        // what is the initial plot? that's the dataframe one plotted initially (for example using plotCsvString(...) before using addDataPoint

        // normalize, so that the farthest away point is still within the xLen yLen zLen frame

       
        // the default values are 0. after the normalization loops the case of
        // them still being 0 will be handled by assigning 1 to x1frac, x2frac and/or x3frac
        let minX1, maxX1, minX2, maxX2, minX3, maxX3
        // don't use deprecated values
        if(!keepOldPlot || !this.IsPlotmeshValid(mode))
        {
            this.oldData.normalization.minX1 = 0
            this.oldData.normalization.maxX1 = 0
            this.oldData.normalization.minX2 = 0
            this.oldData.normalization.maxX2 = 0
            this.oldData.normalization.minX3 = 0
            this.oldData.normalization.maxX3 = 0
        }

        // store this.dimensions._Len data when normalization is off, because for the numbers the maximum displayed number has to be indicated somewhere

        if(normalizeX1 || keepOldPlot)
        {
            minX1 = this.oldData.normalization.minX1
            maxX1 = this.oldData.normalization.maxX1
        }
        else
        {
            minX1 = 0
            maxX1 = this.dimensions.xLen
        }

        if(normalizeX2 || keepOldPlot)
        {
            minX2 = this.oldData.normalization.minX2
            maxX2 = this.oldData.normalization.maxX2
        }
        else
        {
            minX2 = 0
            maxX2 = this.dimensions.yLen
        }

        if(normalizeX3 || keepOldPlot)
        {
            minX3 = this.oldData.normalization.minX3
            maxX3 = this.oldData.normalization.maxX3
        }
        else
        {
            minX3 = 0
            maxX3 = this.dimensions.zLen
        }
        
        let colors = {dfColors, hueOffset}
        let columns = {x1col, x2col, x3col}
        let normalization = {normalizeX1, normalizeX2, normalizeX3, x1frac, x2frac, x3frac, minX1, minX2, minX3, maxX1, maxX2, maxX3}
        let appearance = {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize, labeled}
        let dimensions = this.dimensions

        if(mode === BARCHART_MODE)
        {

            // plotDataFrame
            //-------------------------//
            //        Bar Chart        //
            //-------------------------//

            barchart(this, df, colors, columns, normalization, appearance, this.SceneHelper.cameraMode)
            
        }
        else if(mode === POLYGON_MODE)
        {

            // plotDataFrame
            //-------------------------//
            //       3D-Mesh Plot      //
            //-------------------------//

            interpolatedpolygon(this, df, colors, columns, normalization, appearance, dimensions)


        }
        else if(mode == SOM_MODE)
        {

            // plotDataFrame
            //-------------------------//
            //   self organizing map   //
            //-------------------------//
            
            selforganizingmap(this, df, colors, columns, normalization, appearance, dimensions)
            
        }
        else if(mode === LINEPLOT_MODE)
        {

            // plotDataFrame
            //-------------------------//
            //        lineplot         //
            //-------------------------//
        
            lineplot(this, df, colors, columns, normalization, appearance, dimensions)

        }
        else
        {

            // plotDataFrame
            //-------------------------//
            //       scatterplot       //
            //-------------------------//
            // This is the default mode
            
            if(mode !== SCATTERPLOT_MODE)
                console.error("mode \""+mode+"\" unrecognized. Assuming \"scatterplot\"")
                
            scatterplot(this, df, colors, columns, normalization, appearance, dimensions)

        }

        this.benchmarkStamp("made a plot")

        // those values can be overwritten by the various plotMode functions
        if(normalizeX1)
        {
            minX1 = normalization.minX1
            maxX1 = normalization.maxX1
            x1frac = normalization.x1frac
        }

        if(normalizeX2)
        {
            minX2 = normalization.minX2
            maxX2 = normalization.maxX2
            x2frac = normalization.x2frac
        }

        if(normalizeX3)
        {
            minX3 = normalization.minX3
            maxX3 = normalization.maxX3
            x3frac = normalization.x3frac
        }
        

        
        // plotDataFrame
        //-------------------------//
        //       Axes Numbers      //
        //-------------------------//

        if(this.SceneHelper.axes)
        {
            // remember that axes get disposed when the dimensions (xLen, yLen, zLen) are changing
            // so updateNumbersAlongAxis should get called (that means updatex_ should be true) when the numbers don't exist or something
            // UPDATE: I think it's best that settings like that have to be done before making the plot

            let xLen = this.dimensions.xLen
            let yLen = this.dimensions.yLen
            let zLen = this.dimensions.zLen

            this.SceneHelper.render()

            // decide about whether or not the numbers need to be updated
            // min and max numbers will contain either normalization data or 0 and the axis-Length
            // check for children.length because if there are no children in _Numbers, that means there haven't been numbers printed yet
            let updatex1 = this.SceneHelper.xNumbers.children.length == 0 || this.oldData.normalization.maxX1 !== maxX1 || this.oldData.normalization.minX1 !== minX1
            let updatex2 = this.SceneHelper.yNumbers.children.length == 0 || this.oldData.normalization.maxX2 !== maxX2 || this.oldData.normalization.minX2 !== minX2
            let updatex3 = this.SceneHelper.zNumbers.children.length == 0 || this.oldData.normalization.maxX3 !== maxX3 || this.oldData.normalization.minX3 !== minX3

            this.oldData.normalization = {}
            this.oldData.normalization.minX1 = minX1
            this.oldData.normalization.maxX1 = maxX1
            this.oldData.normalization.minX2 = minX2
            this.oldData.normalization.maxX2 = maxX2
            this.oldData.normalization.minX3 = minX3
            this.oldData.normalization.maxX3 = maxX3
            this.oldData.numberDensity = numberDensity

            // creating and updating textures is a very costly task. Do this in a 15fps cycle
            if(this.fps15 === 0)
            {
                if(updatex1)
                {
                    this.SceneHelper.updateNumbersAlongAxis(numberDensity, xLen, XAXIS, minX1, maxX1, this.animationFunc !== null)
                }
                
                if(updatex2)
                {
                    // because barcharts are not normalized in the way, that the highest bar is as high as yLen and that the lowest is flat (0) (like scatterplots)
                    // they have negative bars. So they are normalized a little bit differently. So the axes have to be numbered in a slightly different way
                    // minX2 is important for the positioning of the axis number. But in the case of barcharts, it needs to be 0, because the whole plot is not moved
                    // to the top by minX1.
                    let minX2_2 = minX2
                    let yLen_2 = yLen
                    if(mode === BARCHART_MODE)
                    {
                        minX2_2 = 0
                        yLen_2 = yLen * (maxX2-minX2_2)/x2frac
                    }
                    this.SceneHelper.updateNumbersAlongAxis(numberDensity, yLen_2, YAXIS, minX2_2, maxX2, this.animationFunc !== null)
                }

                if(updatex3)
                {
                    this.SceneHelper.updateNumbersAlongAxis(numberDensity, zLen, ZAXIS, minX3, maxX3, this.animationFunc !== null)
                }
            }

        }
        else
        {
            // make sure to update those, no matter what's going on with the axis
            // they are needed for addDataPoint, because otherwise one would have
            // to iteate over the complete dataset including the new point again.
            this.oldData.normalization = {}
            this.oldData.normalization.minX1 = minX1
            this.oldData.normalization.maxX1 = maxX1
            this.oldData.normalization.minX2 = minX2
            this.oldData.normalization.maxX2 = maxX2
            this.oldData.normalization.minX3 = minX3
            this.oldData.normalization.maxX3 = maxX3
        }

        this.SceneHelper.render()
        

        // plotDataFrame
        //-------------------------//
        //         History         //
        //-------------------------//
        // used for addDataPoint to store what was plotted the last time
        // also used to store the material in some cases so that it does not have to be recreated each time

        // now that the script arrived here, store the options to make easy redraws possible
        // update cache
        
        this.oldData.options.mode = mode

        // those are always handy to remember and they are needed in some cases
        this.oldData.normalization.x1frac = x1frac
        this.oldData.normalization.x2frac = x2frac
        this.oldData.normalization.x3frac = x3frac

        if(updateOldData === true) // if updating is allowed. is only important for the dataframe basically
        {
            if(headerRow != undefined)
                this.oldData.dataframe = ([headerRow]).concat(df)
            else
                this.oldData.dataframe = df

            this.oldData.x1col = x1col
            this.oldData.x2col = x2col
            this.oldData.x3col = x3col

            options.header = header // making sure that the default value is stored makes some things easier
            // if the user used the options.header parameter it's fine, as both variables will contain the same information anyway

            this.oldData.options = options
        }

        this.SceneHelper.makeSureItRenders(this.animationFunc)
    }



    /**
     * repeats the drawing using the dataframe memorized in oldData, but adds a new datapoint to it
     * @param {any} newDatapoint Array that contains the attributes of the datapoints in terms of x1, x2, x3, x4, x5 etc.
     * - for example [100,100,100,100,"rock"]
     * @param {object} options json object with one or more of the following parameters:
     * - mode {string}: "barchart", "scatterplot" or "lineplot"
     * - colorCol {number}: leave undefined or set to -1, if defaultColor should be applied. Otherwise the index of the csv column that contains color information.
     * (0, 1, 2 etc.). Formats of the column within the .csv file allowed:
     * numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically.
     * Integers that are used as class for labeled data would result in various different hues in the same way.
     * hex strings ("#f8e2b9"). "rgb(...)" strings. "hsl(...)" strings. strings as labels (make sure to set labeled = true).
     * - normalizeX1 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X1 Axis
     * - normalizeX2 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X2 Axis (y)
     * - normalizeX3 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X3 Axis
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - labeled {boolean}: true if colorCol contains labels (such as 0, 1, 2 or frog, cat, dog). This changes the way it is colored.
     * Having it false on string-labeled data will throw a warning, but it will continue as it was true
     * - defaultColor {number or string}: examples: #1a3b5c, 0xfe629a, rgb(0.1,0.2,0.3), hsl(0.4,0.5,0.6). Gets applied when either colorCol is -1, undefined or ""
     * - x1frac {number}: by how much to divide the datapoints x1 value to fit into [-1;1]. will be overwritten if normalization is on
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]. will be overwritten if normalization is on
     * - x3frac {number}: by how much to divide the datapoints x3 value to fit into [-1;1]. will be overwritten if normalization is on
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.04
     * - filterColor {boolean}: false: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then and not filtered to a heatmap). Default true, which filters it to a heatmap
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */
    addDataPoint(newDatapoint, options={})
    {            
        // is the plot a formula?
        if(this.oldData.options.mode == POLYGON_MODE)
        {
            // to avoid destroying the plot, return here
            return console.error("the current plot is a",POLYGON_MODE,"which is only the case for formulas. You can't add datapoints to formulas")
        }

        // add the old options to the current options
        for(let key in this.oldData.options)
        {
            if(options[key] === undefined)
            {
                options[key] = this.oldData.options[key]
            }
        }

        // the following have to be like this, they can't be overwritten by the user:
        // no header in newDataPoint and don't delete the original dataframe from cache
        options.header = false
        options.updateOldData = false

        if(this.isAnimated())
            options.fastForward = true // performance


        if(options.normalizeX1 === undefined) options.normalizeX1 = false
        if(options.normalizeX2 === undefined) options.normalizeX2 = false
        if(options.normalizeX3 === undefined) options.normalizeX3 = false
        // default keepOldPlot, but make it possible to overwrite it.

        // true by default, so that the old plot gets extended with the new datapoint.
        // Set to false to replace the old plot with this new single datapoint
        // check for undefined, it is a boolean value! don't if(!foobar)
        if(options.keepOldPlot === undefined) options.keepOldPlot = true


        // create the datapoint data structure (an array) from this
        if(typeof(newDatapoint) === "string")
        {
            newDatapoint = newDatapoint.split(options.separator)
            for(let i = 0;i < newDatapoint.length; i++)
                newDatapoint[i] = newDatapoint[i].trim()
        }

        // add the datapoint to the dataframe
        this.oldData.dataframe[this.oldData.dataframe.length] = newDatapoint
        
        if(newDatapoint.length != this.oldData.dataframe[0].length)
        {
            return console.error("the new datapoint does not match the number of column in the in oldData stored dataframe ("+newDatapoint.length+" != "+this.oldData.dataframe[0].length+")")
        }

        // because of keepOldPlot, only hand the newDatapoint over to plotDataFrame
        this.plotDataFrame([newDatapoint],
            this.oldData.x1col,
            this.oldData.x2col,
            this.oldData.x3col,
            options
        )


        // destroy the in oldData stored string csv checkstring, indicate that the dataframe has been modified by addDataPoint
        // do this, because otherwise when plotting the same (initial) dataframe again it might not realize that the in oldData stored dataframe has
        // been extended by addDataPoint, so plotCsvString might use the in oldData stored (longer) dataframe than the one passed as parameter
        this.oldData.checkstring += "_addDP"
    }



    /**
     * updates the legend with new information. basically recreates the innerHTML of this.legend.element
     * @param {object} colorMap COLORLIB.getColorMap(...) information. can be null
     * @param {object} options json object containing one or more of x1title, x2title, x3title and title
     * @private
     */
    populateLegend(options)
    {
        // update the legend with the label color information
        // open legend, add title
        let legendHTML = ""
        if(options.title && options.title != "")
        {
            legendHTML += "<h1>"+options.title+"</h1>"
        }

        // add info about the labels and the colors
        if(options.colorMap && options.colorMap.labelColorMap != {})
        {
            // label colors:
            legendHTML += "<table class =\"jsP3D_labelColorLegend\"><tbody>" // can't append to innerHTML directly for some funny reason
            for(let key in options.colorMap.labelColorMap)
            {
                legendHTML += "<tr>"
                legendHTML += "<td><span class =\"jsP3D_labelColor\" style =\"background-color:#" + options.colorMap.labelColorMap[key].color.getHexString() + ";\"></span></td>"
                legendHTML += "<td>" + key + "</td>"
                legendHTML += "</tr>"
            }
            legendHTML += "</tbody></table>"
        }

        // axes titles:
        legendHTML += "<table class =\"jsP3D_axesTitleLegend\"><tbody>"
        if(this.SceneHelper.cameraMode != LEFTCAMERA  && options.x1title) legendHTML += "<tr><td>x:</td><td>"+options.x1title+"</td></tr>"
        if(this.SceneHelper.cameraMode != TOPCAMERA   && options.x2title) legendHTML += "<tr><td>y:</td><td>"+options.x2title+"</td></tr>"
        if(this.SceneHelper.cameraMode != FRONTCAMERA && options.x3title) legendHTML += "<tr><td>z:</td><td>"+options.x3title+"</td></tr>"
        legendHTML += "</tbody></table>"

        // is the content similar? Then don't overwrite because it will trigger rerenders every time (observed in the chromium Elements view)
        if(this.legend.element.innerHTML.trim() != legendHTML) // for some reason I have to trim the current innerHTML
        {
            this.legend.element.innerHTML = legendHTML
        }
    }

    /**
     * private method to to initialize the legend variables and creates a dom object for it. Happens in the constructor.
     * @private
     */
    initializeLegend()
    {
        this.legend = {}
        this.legend.element = document.createElement("div")
        this.legend.element.className = "jsP3D_legend"
        this.legend.title = ""
        this.legend.x1title = ""
        this.legend.x2title = ""
        this.legend.x3title = ""
    }

    /**
     * appends the legend to a specific container. It is already generated at this point.
     * 
     * Make sure to style it using the css of your website because otherwise the colored
     * span elements will not be visible.
     * 
     * @param {DOM} container
     * @return returns the dom element of the legend
     */
    createLegend(container)
    {
        if(container === null)
        {
            return console.error("container for createLegend not found")
        }
            
        container.appendChild(this.legend.element)
        return(this.legend.element)
    }



    /**
     * if plotmesh is invalid it gets cleared. The point of this is that materials and such don't have to be recreated again and again
     * It checks the mesh.type, mesh.name and mesh.geometry.type if it matches with the parameter check
     * @return returns true if plotmesh is still valid and existant
     * @private
     */
    IsPlotmeshValid(check)
    {
        let obj = this.plotmesh

        if(obj === null)
        {
            return false
        }

        if(obj.name === check || obj.type === check)
        {
            return true
        }

        return false
    }



    /**
     * proper plotmesh removal
     * @private
     */
    disposePlotMesh()
    {
        this.SceneHelper.disposeMesh(this.plotmesh)
        // this.clearOldData() // don't do that, because maybe addDataPoint is used afterwards and that relies on oldData (does that even make sense? it has to probably)
        this.plotmesh = null
    }



    /**
     * clears the oldData-object and initializes it
     * @private
     */
    clearOldData()
    {
        this.oldData = {}

        this.oldData.normalization = {
            minX1: 0, maxX1: 0,
            minX2: 0, maxX2: 0,
            minX3: 0, maxX3: 0,
        }

        this.oldData.labelColorMap = {}
        this.oldData.numberOfLabels = 0
        this.oldData.material = null
        this.oldData.dataframe = []
        this.oldData.x1col = 0
        this.oldData.x2col = 1
        this.oldData.x3col = 2
        this.clearCheckString()
        this.oldData.barsGrid = null
        
        this.oldData.options = {}
        this.oldData.options.mode = SCATTERPLOT_MODE
    }



    /**
     * clears the checkstring, so that plotCsvString knows that the stored dataframe does not originate from it.
     * The point of the checkstring is to prevent parsing the same dataframe twice in a row, to increase performance.
     */
    clearCheckString()
    {
        this.oldData.checkstring = ""
    }



    /**
     * sets the container of this plot
     * TODO what happens when this function is used during runtime? Can the container be changed? What if the containers have different width and height?
     * @param {object} container DOM-Element of the new container
     * @private
     */
    setContainer(container)
    {
        if(typeof(container) != "object")
            return console.error("param of setContainer (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")

        this.container = container
        this.SceneHelper.renderer.setSize(container.offsetWidth, container.offsetHeight)

        this.container.appendChild(this.SceneHelper.renderer.domElement)
    }



    /**
     * not used for initialization, but rather for changing dimensions during runtime. will trigger axes recreation
     * Note that this has to be done before creating a plot
     * @param {object} dimensions json object can contain the following:
     * - xRes number of datapoints/vertices for the x-axis and plotFunction/plotFormula.
     * - zRes number of datapoints/vertices for the z-axis and plotFunction/plotFormula.
     * - xLen length of the x-axis. This is for the frame for data normalisation and formula plotting
     * - yLen length of the y-axis. This is for the frame for data normalisation and formula plotting
     * - zLen length of the z-axis. This is for the frame for data normalisation and formula plotting
     */
    setDimensions(dimensions)
    {
        if(typeof(dimensions) != "object")
            return console.error("param of setDimensions (dimensions) should be a json object containing at least one of xRes, zRes, xLen, yLen or zLen")

        // vertices counts and plot shape/dimensions changed, so the mesh has to be recreated
        this.disposePlotMesh()
        this.clearOldData()
        
        if(dimensions.xLen === 0 && dimensions.yLen === 0) return console.error("only one dimension can be zero",dimensions)
        if(dimensions.yLen === 0 && dimensions.zLen === 0) return console.error("only one dimension can be zero",dimensions)
        if(dimensions.zLen === 0 && dimensions.xLen === 0) return console.error("only one dimension can be zero",dimensions)

        if(dimensions.xLen === 0)
        {
            dimensions.xLen = 0.001 // 0 will cause trouble because determinants become zero
            dimensions.xRes = 1
            this.SceneHelper.changeCameraMode(LEFTCAMERA) // uses an orthographic camera
        }
        else if(dimensions.yLen === 0)
        {
            dimensions.yLen = 0.001 // 0 will cause trouble because determinants become zero
            dimensions.yRes = 1
            this.SceneHelper.changeCameraMode(TOPCAMERA) // uses an orthographic camera
        }
        else if(dimensions.zLen === 0)
        {
            dimensions.zLen = 0.001 // 0 will cause trouble because determinants become zero
            dimensions.zRes = 1
            this.SceneHelper.changeCameraMode(FRONTCAMERA) // uses an orthographic camera
        }
        else
        {
            this.SceneHelper.changeCameraMode(DEFAULTCAMERA)
        }

        if(dimensions.xRes) this.dimensions.xRes = Math.max(1, Math.abs(dimensions.xRes|0))
        if(dimensions.zRes) this.dimensions.zRes = Math.max(1, Math.abs(dimensions.zRes|0))
        if(dimensions.xLen) this.dimensions.xLen = Math.abs(dimensions.xLen)
        if(dimensions.yLen) this.dimensions.yLen = Math.abs(dimensions.yLen)
        if(dimensions.zLen) this.dimensions.zLen = Math.abs(dimensions.zLen)

        // move
        this.SceneHelper.centerCamera(this.dimensions) // use this.dimensions and not dimensions
        this.SceneHelper.updateAxesSize(this.dimensions,this.oldData.normalization)

        // axes have to be updates aswellc

        // takes effect once the mesh gets created from new, except for the lengths indicated by the axes. those update immediatelly
        this.SceneHelper.render()
    }






    /*-- Animations --*/

    /**
     * tells this object to animate this. You can stop the animation using stopAnimation()
     * @example
     * 
     *      var i = 0;
     *      plot.animate(function() {
     *              i += 0.01;
     *              plot.plotFormula("sin(2*x1+" + i + ")*sin(2*x2-" + i + ")", null, JSPLOT3D.BARCHART_MODE);
     *      }
     * @param {function} animationFunc
     */
    animate(animationFunc)
    {
        this.SceneHelper.onChangeCamera = function() {}
        this.animationFunc = animationFunc
        this.callAnimation()
    }

    /**
     * true if an animation is active, false if not
     */
    isAnimated()
    {
        if(this.animationFunc != null)
        {
            return true
        }
        return false
    }

    /**
     * stops the ongoing animation. To start an animation, see animate(...)
     */
    stopAnimation()
    {
        this.animationFunc = null
        this.fps15 = 0
    }

    /**
     * executes the animation. Use animate(...) if you want to set up an animation
     * @private
     */
    callAnimation()
    {
        if(this.animationFunc !== null)
        {
            this.animationFunc()
            this.SceneHelper.render()
        }
        requestAnimationFrame(()=>this.callAnimation())

        // 0 1 2 3  0 1 2 3  0 1 2 ...
        // check for this.fps15 === 0 and do something if true
        // this way a lower fps framerate for certain tasks can be achieved to improve performance
        this.fps15 += 1
        this.fps15 = this.fps15 % 4
    }





    /*-- Benchmarking --*/

    /**
     * enables benchmarking. Results will be printed into the console.
     * To disable it, use: disableBenchmarking(). To print a timestamp to the console, use benchmarkStamp("foobar")
     */
    enableBenchmarking()
    {
        this.benchmark = {}
        this.benchmark.enabled = true
        this.benchmark.recentTime = window.performance.now()
    }

    /**
     * disables benchmarking. To enable it, use: enableBenchmarking(). To print a timestamp to the console, use benchmarkStamp("foobar")
     */
    disableBenchmarking()
    {
        this.benchmark.enabled = false
    }

    /**
     * prints time and an identifier to the console, if benchmarking is enabled. You can enable it using enableBenchmarking() and stop it using disableBenchmarking()
     * @param {string} identifier printed at the beginning of the line
     */
    benchmarkStamp(identifier)
    {
        if(this.benchmark.enabled === false)
        {
            return
        }

        console.log(identifier+": "+(window.performance.now()-this.benchmark.recentTime)+"ms")
        this.benchmark.recentTime = window.performance.now()
    }






    /*-- some public API functions that forward to Scenehelper --*/

    /**
     * changes the background color and triggers a rerender
     * @param {string} color Examples: 0xffffff, "#ff6600", "rgb(1,0.5,0)", "hsl(0.7,0.6,0.3)"
     */
    setBackgroundColor(color)
    {
        this.SceneHelper.setBackgroundColor(color)
    }

    /**
     * Creates new axes with the defined color and triggers a rerender. Note that this has to be done before creating a plot
     * @param {String} color axes color. Examples: 0xffffff, "#ff6600", "rgb(1,0.5,0)", "hsl(0.7,0.6,0.3)"
     */
    setAxesColor(color)
    {
        this.SceneHelper.createAxes(color, this.dimensions, this.oldData.normalization)

        this.SceneHelper.makeSureItRenders(this.animationFunc)
    }

    /**
     * resets the camera position
     */
    centerCamera()
    {
        this.SceneHelper.centerCamera(this.dimensions)
    }

    /**
     * removes the axes. They can be recreated using createAxes(color)
     */
    removeAxes()
    {
        this.SceneHelper.removeAxes()
    }





    /*-- typechecking --*/
    
    /**
     * prints an error, telling you what went wrong with a variable (expected type is wrong)
     * @param {string} varname 
     * @param {any} variable 
     * @param {string} expectedType 
     * @private
     */
    errorParamType(varname, variable, expectedType)
    {
        console.error("expected '"+expectedType+"' but found '"+typeof(variable)+"' for "+varname+" ("+variable+")")
    }
    
    /**
     * checks if the variable is boolean or not
     * @param {string} varname 
     * @param {any} variable 
     * @return {boolean} true if valid, false if not
     * @private
     */
    checkBoolean(varname, variable)
    {
        if(variable == undefined)
            return // not defined in the (optional) options, don't do anything then
        let a = (variable === true || variable === false)
        if(!a) this.errorParamType(varname, variable, "boolean")
        return(a) // returns true (valid) or false
    }

    /**
     * checks if the variable is a number or not
     * @param {string} varname 
     * @param {any} variable 
     * @return {boolean} true if valid, false if not
     * @private
     */
    checkNumber(varname, variable)
    {
        if(variable == undefined || variable === "")
            return // not defined in the (optional) options, don't do anything then
        if(typeof(variable) != "number" && isNaN(parseFloat(variable)))
            return this.errorParamType(varname, variable, "number")
        else return true // returns true (valid) or false
    }
}
