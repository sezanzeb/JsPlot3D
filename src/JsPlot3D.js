/** @module JsPlot3D */
const THREE = require("three")
const OrbitControls = require('three-orbit-controls')(THREE)
import MathParser from "./MathParser.js"
import ColorManager from "./ColorManager.js"



/**
 * Plots Dataframes and Formulas into a 3D Space
 */
export class Plot
{

    /**
     * Creates a Plot instance, so that a single canvas can be rendered. After calling this constructor, rendering can
     * be done using plotFormula(s), plotCsvString(s) or plotDataFrame(df)
     * @param {object} container     html div DOM element which can then be selected using
     * - Plot(document.getElementById("foobar"))
     * @param {json}   options       at least one of backgroundClr or axesClr in a Json Format {}. Colors can be hex values "#123abc" or 0x123abc
     */
    constructor(container, options={})
    {
        // parameter checking
        let backgroundColor = 0xffffff
        let axesColor = 0x000000
        if(typeof(container) != "object")
            return console.error("second param for the Plot constructor (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")

        // some plotdata specific variables. I want setters and getter for all those at some point
        this.MathParser = new MathParser()
        this.resetCalculation() // configures the variables
        // this.dataPointImage = "datapoint.png"
        this.ColorManager = new ColorManager(THREE)

        if(options.backgroundColor != undefined)
            backgroundColor = options.backgroundColor
        if(options.axesColor != undefined)
            axesColor = options.axesColor


        // three.js setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setClearColor(this.ColorManager.getColorObjectFromAnyString(backgroundColor))
        this.scene = new THREE.Scene()
        this.setContainer(container)

        // boundaries and dimensions of the plot data
        this.setDimensions({xLen:1,yLen:1,zLen:1,xRes:20,zRes:20})
        this.createLight()
        this.createAxes(axesColor)
        this.createArcCamera()

        this.legend = {}
        this.legend.element = document.createElement("div")
        this.legend.element.className = "jsP3D_legend"
        this.legend.title = ""
        this.legend.x1title = ""
        this.legend.x2title = ""
        this.legend.x3title = ""
        this.legend.colors = {}

        this.resetCache()

        // this.enableBenchmarking()
        this.render()
    }



    /**
     * plots a formula into the container
     * @param {string}  originalFormula string of formula
     * @param {object} options
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
     * - x1frac {number}: by how much to divide the datapoints x1 value to fit into [-1;1]
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]
     * - x3frac {number}: by how much to divide the datapoints x3 value to fit into [-1;1]
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.02
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateCache {boolean}: if false, don't overwrite the dataframe that is stored in the cache
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0  
     */
    plotFormula(originalFormula, options={})
    {

        let mode
        let x2frac = 1
        let normalizeX2 = true
        
        if(options.mode != undefined)
            mode = options.mode
        if(options.x2frac != undefined)
            x2frac = options.x2frac
        if(options.normalizeX2 != undefined)
            normalizeX2 = options.normalizeX2

        if(originalFormula == undefined || originalFormula == "")
            return console.error("first param of plotFormula (originalFormula) is undefined or empty")
        if(typeof(originalFormula) != "string")
            return console.error("first param of plotFormula (originalFormula) should be string")

        this.resetCalculation()
        this.parsedFormula = this.MathParser.parse(originalFormula)
        this.dfCache.checkstring = "" // don't fool plotCsvString into believing the cache contains still old csv data

        if(mode == "scatterplot")
        {
            
            ////////  SCATTERPLOT    ////////

            // if scatterplot, create a dataframe and send it to plotDataFrame
            let df = new Array(this.xVerticesCount * this.zVerticesCount)

            // the three values that are going to be stored in the dataframe
            let y = 0
            let x = 0
            let z = 0

            // line number in the new dataframe
            let i = 0

            for(let x = 0; x < this.xVerticesCount; x++)
            {
                for(let z = 0; z < this.zVerticesCount; z++)
                {
                    y = this.f(x/this.xRes,z/this.zRes) // calculate y. y = f(x1,x2)
                    df[i] = [x,y,z] // store the datapoint
                    i++
                }
            }

            options.colorCol = 1 // y result of the evaluated formula

            // continue plotting this DataFrame
            this.plotDataFrame(df, 0, 1, 2, options)
        }
        else if(mode == "barchart")
        {


            ////////  BARCHART ////////


            // if barchart, create a dataframe and send it to plotDataFrame
            let df = new Array(this.xVerticesCount * this.zVerticesCount)

            // the three values that are going to be stored in the dataframe
            let y = 0
            let x = 0
            let z = 0

            // line number in the new dataframe
            let i = 0

            for(let x = 0; x <= this.xVerticesCount; x++)
            {
                for(let z = 0; z <= this.zVerticesCount; z++)
                {
                    y = this.f(x/this.xRes,z/this.zRes) // calculate y. y = f(x1,x2)
                    df[i] = [x,y,z] // store the datapoint
                    i++
                }
            }

            options.colorCol = 1 // y result of the evaluated formula

            // continue plotting this DataFrame
            this.plotDataFrame(df, 0, 1, 2, options)
        }
        else
        {

            if(mode != "polygon" && mode != undefined)
                console.warn("mode \""+mode+"\" unrecognized. Assuming \"polygon\"")

            ////////  POLYGON ////////


            // might need to recreate the geometry and the matieral
            // is there a plotmesh already? Or maybe a plotmesh that is not created from a 3D Plane (could be a scatterplot or something else)
            if(!this.IsPlotmeshValid("polygonFormula"))
            {
                // create plane, divided into segments
                let planegeometry = new THREE.PlaneGeometry(this.xLen,this.zLen,this.xVerticesCount,this.zVerticesCount)
                // move it
                planegeometry.rotateX(Math.PI/2)
                planegeometry.translate(this.xLen/2,0,this.zLen/2)

                // color the plane
                let plotmat = new THREE.MeshStandardMaterial({
                    color: 0xff3b00,
                    emissive: 0x2f7b8c,
                    roughness: 0.8,
                    // wireframe: true,
                    side: THREE.DoubleSide
                    })

                this.plotmesh = new THREE.Mesh(planegeometry, plotmat)
                this.plotmesh.name = "polygonFormula"
            }
            
            // if not, go ahead and manipulate the vertices

            // TODO hiding faces if typeof y is not number:
            // https:// stackoverflow.com/questions/11025307/can-i-hide-faces-of-a-mesh-in-three-js

            // modifying vertex positions:
            // https:// github.com/mrdoob/three.js/issues/972
            let y = 0
            let vIndex = 0

            // to counter the need for dividing each iteration
            let x1Actual = 0 // x
            let x3Actual = (this.zVerticesCount-1)/this.zRes // z
            let x1ActualStep = 1/this.xRes
            let x3ActualStep = 1/this.zRes
            let minX2 = 0
            let maxX2 = 0

            for(let z = this.zVerticesCount; z >= 0; z--)
            {
                for(let x = 0; x <= this.xVerticesCount; x++)
                {
                    y = this.f(x1Actual,x3Actual)
                    this.plotmesh.geometry.vertices[vIndex].y = y
                    this.plotmesh.geometry.colors[vIndex] = new THREE.Color(0x6600ff)
                    vIndex ++
                    x1Actual += x1ActualStep
                    if(y > maxX2)
                        maxX2 = y
                    if(y < minX2)
                        minX2 = y
                }
                x1Actual = 0
                x3Actual -= x3ActualStep
            }
            
            if(normalizeX2)
            {
                let a = Math.max(Math.abs(maxX2),Math.abs(minX2)) // based on largest |value|
                let b = Math.abs(maxX2-minX2) // based on distance between min and max
                x2frac = Math.max(a,b) // hybrid
                this.plotmesh.geometry.scale(1,1/x2frac,1)
            }

            this.scene.add(this.plotmesh)

            // normals need to be recomputed so that the lighting works after the transformation
            this.plotmesh.geometry.computeFaceNormals()
            this.plotmesh.geometry.computeVertexNormals()
            this.plotmesh.geometry.__dirtyNormals = true
            // make sure the updated mesh is actually rendered
            this.plotmesh.geometry.verticesNeedUpdate = true
            this.makeSureItRenders()
        }
    }



    /**
     * plots a .csv string into the container
     * @param {string}  sCsv        string of the .csv file, e.g."a;b;c\n1;2;3\n2;3;4"
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: 0
     * @param {number}  x2col       column index used for transforming the x2 axis (y). default: 1
     * @param {number}  x3col       column index used for plotting the x3 axis (z). default: 2
     * @param {object}  options     json object with one or more of the following parameters:
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
     * - x1frac {number}: by how much to divide the datapoints x1 value to fit into [-1;1]
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]
     * - x3frac {number}: by how much to divide the datapoints x3 value to fit into [-1;1]
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.02
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateCache {boolean}: if false, don't overwrite the dataframe that is stored in the cache
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     */
    plotCsvString(sCsv, x1col, x2col, x3col, options = {})
    {
        //---------------------------//
        //  parameter type checking  //
        //---------------------------//

        // a more complete checking will be done in plotDataFrame once the dataframe is generated.
        // only check what is needed in plotCsvString

        if(sCsv === "" || sCsv == undefined)
            return console.error("dataframe is empty")
        // default config
        let separator=","
        let title=""
        let fraction=1
        let csvIsInGoodShape=false
        let header=true // assume header=true for now so that the parsing is not making false assumptions because it looks at headers

        // some helper functions
        let errorParamType = (varname, variable, expectedType) => console.error("expected '"+expectedType+"' but found '"+typeof(variable)+"' for "+varname+" ("+variable+")")
        let checkBoolean = (varname, variable) => {
            if(variable == undefined)
                return // not defined in the (optional) options, don't do anything then
            let a = (variable == true || variable == false)
            if(!a) errorParamType(varname, variable, "boolean")
            return(a) // returns true (valid) or false
        }
        let checkNumber = (varname, variable) => {
            if(variable == undefined || variable == "")
                return // not defined in the (optional) options, don't do anything then
            if(typeof(variable) != "number" && isNaN(parseFloat(variable)))
                return errorParamType(varname, variable, "number")
            else return true // returns true (valid) or false
        }
        // make sure options is defined
        if(typeof(options) == "object")
        {
            // seems like the user sent some parameters. check them

            // treat empty strings as if it was undefined in those cases:
            if(options.separator == "")
                options.separator = undefined

            // check numbers. Overwrite if it's good. If not, default value will remain
            if(checkNumber("fraction",options.fraction))
                fraction = parseFloat(options.fraction)

            // check booleans
            if(checkBoolean("csvIsInGoodShape",options.csvIsInGoodShape))
                csvIsInGoodShape = options.csvIsInGoodShape
            if(checkBoolean("header",options.header))
                header = options.header

            // check everything else
            if(options.separator != undefined)
                separator = options.separator
            if(options.title != undefined)
                title = options.title
        }
        else
        {
            options = {}
        }

        this.benchmarkStamp("start")

        //-------------------------//
        //         caching         //
        //-------------------------//

        // still the same data?
        // create a very quick checksum sort of string
        let stepsize = parseInt(sCsv.length/20)
        let samples = ""
        for(let i = 0;i < sCsv.length; i+=stepsize)
            samples = samples + sCsv[i]

        // take everything into account that changes how the dataframe looks after the processing
        let checkstring = title+sCsv.length+samples+fraction+separator

        // now check if the checksum changed. If yes, remake the dataframe from the input
        if(this.dfCache == undefined || this.dfCache.checkstring != checkstring)
        {
            //-------------------------//
            //       creating df       //
            //-------------------------//
            // and caching it afterwards

            // new csv arrived:

            // transform the sCsv string to a dataframe
            let data = sCsv.split(/[\n\r]+/g)

            if(fraction <= 1)
                data = data.slice(0,data.length-data.length*(1-fraction))

            if(data[0].trim() == "") // to prevent an error I have encountered when reading a csv from DOM Element innerHTML.
            // This probably happens when the csv data starts one line below the opening bracket of the Element
                data = data.slice(-(data.length-1))
            if(data[data.length-1].trim() == "")
                data.pop()

            // now check if the dataframe is empty
            if(data.length == 0)
                return console.error("dataframe is empty")

            // find out the separator automatically if the user didn't define it
            if(options.separator == undefined || data[0].indexOf(separator) == -1)
            {
                // in case of undefined or -1, assume ;
                separator = ";"

                if(data[0].indexOf(separator) == -1)
                    separator = ","

                if(data[0].indexOf(separator) == -1)
                    separator = /[\s\t]{2,}/g // tabbed data

                if(data[0].search(separator) == -1)
                    return console.error("no csv separator/delimiter was detected. Please set separator:\"...\" according to your file format: \""+data[0]+"\"")


                console.warn("the specified separator/delimiter was not found. Tried to detect it and came up with \""+separator+"\". Please set separator=\"...\" according to your file format: \""+data[0]+"\"")
            }

            if(!csvIsInGoodShape)
            {
                // check 5% of the columns to get the highest number of columns available
                let columnCount = 0
                for(let i = 0;i < Math.min(data.length,data.length*0.05+10);i++)
                {
                    columnCount = Math.max(columnCount,data[i].split(separator).length)
                }

                for(let i = 0;i < data.length; i ++)
                {
                    data[i] = data[i].trim().split(separator)
                    
                    // make sure every row has the same number of columns
                    data[i] = data[i].slice(0,columnCount)
                    data[i] = data[i].concat(new Array(columnCount-data[i].length))

                    // remove leading and ending whitespaces in data
                    for(let j = 0;j < data[i].length; j++)
                    {

                        // make sure every column has stored a value
                        if(data[i][j] == undefined)
                        {
                            data[i][j] = 0
                        }
                        else
                        {
                            // remove quotation marks
                            if(data[i][j][0] == "\"")
                                if(data[i][j][data[i][j].length-1] == "\"")
                                    data[i][j] = data[i][j].slice(1,-1)

                                // parse if possible. if not leave it as it is
                                let parsed = parseFloat(data[i][j])
                                if(!isNaN(parsed))
                                    data[i][j] = parsed // number
                                else
                                    data[i][j].trim() // string
                        }
                    }
                }
            }
            else
            {
                // The user trusts the csv and wants maximum performance
                let startLine = 0
                if(header)
                    startLine = 1

                // split lines into columns
                for(let line = 0;line < data.length; line ++)
                    data[line] = data[line].split(separator)

                // iterate over columns
                for(let col = 0;col < data[0].length; col++)
                {
                    // check if that line can be parsed
                    if(!isNaN(parseFloat(data[startLine][col]))) // if parsable as number 
                        for(let line = 0;line < data.length; line ++) // continue like so for all following datapoints/rows
                            data[line][col] = parseFloat(data[line][col])
                }
            }

            // cache the dataframe. If the same dataframe is used next time, don't parse it again
            this.resetCache()
            this.dfCache.dataframe = data
            this.dfCache.checkstring = checkstring

            this.benchmarkStamp("created the dataframe and cached it")

            // plot the dataframe.
            options.fraction = 1 // Fraction is now 1, because the fraction has already been taken into account

            this.plotDataFrame(data, x1col, x2col, x3col, options)
        }
        else
        {
            console.log("using cached dataframe")
            // cached
            // this.dfCache != undefined and checkstring is the same
            // same data. Fraction is now 1, because the fraction has already been taken into account
            this.plotDataFrame(this.dfCache.dataframe, x1col, x2col, x3col, options)
        }
    }



    /**
     * plots a dataframe on the canvas element which was defined in the constructor of Plot()
     * @param {number[][]}  df      int[][] of datapoints. [row][column]
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: 0
     * @param {number}  x2col       column index used for transforming the x2 axis (y). default: 1
     * @param {number}  x3col       column index used for plotting the x3 axis (z). default: 2
     * @param {object}  options     json object with one or more of the following parameters:
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
     * - x1frac {number}: by how much to divide the datapoints x1 value to fit into [-1;1]
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]
     * - x3frac {number}: by how much to divide the datapoints x3 value to fit into [-1;1]
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.02
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateCache {boolean}: if false, don't overwrite the dataframe that is stored in the cache
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     */
                
    plotDataFrame(df, x1col=0, x2col=1, x3col=2, options={})
    {
        // to optimize for performance, use:
        // {
        //   colorCol: -1 // don't calculate heatmaps
        //   defaultColor: 0xff6600 // whatever you like
        //   normalizeX1: false
        //   normalizeX2: false
        //   normalizeX3: false
        //   updateCache: true // in addDataPoint this is automatically false, otherwise the cache would be overwritten with a single point
        //   fraction: 0.5 // don't plot everything
        // }
        this.benchmarkStamp("plotDataFrame starts")
        //---------------------------//
        //  parameter type checking  //
        //---------------------------//
        // default config
        let header=false
        let colorCol=-1
        let mode="scatterplot"
        let normalizeX1=true
        let normalizeX2=true
        let normalizeX3=true
        let title=""
        let fraction=1 // TODO
        let labeled=false
        let defaultColor=0 // black
        let barchartPadding=0.5
        let dataPointSize=0.02
        let filterColor=true
        let x1title="x1"
        let x2title="x2"
        let x3title="x3"
        let hueOffset=0
        let keepOldPlot=false
        let updateCache=true
        let barSizeThreshold=0
        let x1frac=1
        let x2frac=1
        let x3frac=1
        // let normalizationSmoothing=0

        if(this.dfCache == undefined)
            this.resetCache()

        // when true, the dataframe is a 2D Array an can be accessed like this: df[x][z] = y
        // it's experiemental and does not work yet for all plotting modes. It's there for performance increasing
        // because sometimes I am calculating a dataframe from a formula and then convert it to that [x][z] shape
        // instead of calculating this shape right away
        let dfIsA2DMap=false

        // some helper functions
        let errorParamType = (varname, variable, expectedType) => console.error("expected '"+expectedType+"' but found '"+typeof(variable)+"' for "+varname+" ("+variable+")")
        let checkBoolean = (varname, variable) => {
            if(variable == undefined)
                return false// not defined in the (optional) options, don't do anything then
            let a = (variable == true || variable == false)
            if(!a)
            { errorParamType(varname, variable, "boolean"); return false }
            return(a) // returns true (valid) or false
        }
        let checkNumber = (varname, variable) => { // returns true if it is a number, false if it is either not defined or not a number
            if(variable == undefined || variable === "")
                return false  // not defined in the (optional) options, don't do anything then
            if(typeof(variable) != "number" && isNaN(parseFloat(variable)))
            { errorParamType(varname, variable, "number"); return false }
            return true // returns true (valid) or false
        }

        // make sure options is defined
        if(typeof(options) == "object")
        {
            // seems like the user sent some parameters. check them

            // treat empty strings as if it was undefined in those cases:
            if(options.colorCol == "")
                options.colorCol = undefined

            // check numbers. Overwrite if it's good. If not, default value will remain
            if(options.colorCol != undefined && options.colorCol >= df[0].length)
            {
                console.error("column with index "+options.colorCol+", used as colorCol, is not existant in the dataframe. Disabling coloration")
                options.colorCol = -1
            }
            if(checkNumber("fraction",options.fraction))
                fraction = parseFloat(options.fraction)
            if(checkNumber("barchartPadding",options.barchartPadding))
                barchartPadding = parseFloat(options.barchartPadding)
            if(barchartPadding >= 1)
            {
                barchartPadding = 0
                console.error("barchartPadding is invalid. maximum of 1 and minimum of 0 accepted. Now continuing with barchartPadding = "+barchartPadding)
            }

            if(checkNumber("hueOffset",options.hueOffset))
                hueOffset = parseFloat(options.hueOffset)
            if(checkNumber("x1frac",options.x1frac))
                x1frac = parseFloat(options.x1frac)
            if(checkNumber("x2frac",options.x2frac))
                x2frac = parseFloat(options.x2frac)
            if(checkNumber("x3frac",options.x3frac))
                x3frac = parseFloat(options.x3frac)
            if(checkNumber("colorCol",options.colorCol))
                colorCol = parseFloat(options.colorCol)
            if(checkNumber("dataPointSize",options.dataPointSize))
                dataPointSize = parseFloat(options.dataPointSize)
            if(checkNumber("barSizeThreshold",options.barSizeThreshold))
                barSizeThreshold = parseFloat(options.barSizeThreshold)
            // if(checkNumber("normalizationSmoothing",options.normalizationSmoothing))
            //    normalizationSmoothing = parseFloat(options.normalizationSmoothing)
            if(dataPointSize <= 0)
                console.error("datapoint size is <= 0. It will be invisible")

            // check booleans. Overwrite if it's good. If not, default value will remain
            if(checkBoolean("labeled",options.labeled))
                labeled = options.labeled
            if(checkBoolean("normalizeX1",options.normalizeX1))
                normalizeX1 = options.normalizeX1
            if(checkBoolean("normalizeX2",options.normalizeX2))
                normalizeX2 = options.normalizeX2
            if(checkBoolean("normalizeX3",options.normalizeX3))
                normalizeX3 = options.normalizeX3
            if(checkBoolean("header",options.header))
                header = options.header
            if(checkBoolean("dfIsA2DMap",options.dfIsA2DMap))
                dfIsA2DMap = options.dfIsA2DMap
            if(checkBoolean("filterColor",options.filterColor))
                filterColor = options.filterColor
            if(checkBoolean("keepOldPlot",options.keepOldPlot))
                keepOldPlot = options.keepOldPlot
            if(checkBoolean("updateCache",options.updateCache))
                updateCache = options.updateCache


            // check everything else
            if(options.title != undefined)
                title = options.title
            if(options.defaultColor != undefined)
                defaultColor = options.defaultColor
            if(options.mode != undefined)
                mode = options.mode
            if(options.x1title != undefined)
                x1title = options.x1title
            if(options.x2title != undefined)
                x2title = options.x2title
            if(options.x3title != undefined)
                x3title = options.x3title

        }

        if(checkNumber("x1col",x1col))
            x1col = parseFloat(x1col)
        else x1col = Math.min(0,df[0].length-1)
        if(checkNumber("x2col",x2col))
            x2col = parseFloat(x2col)
        else x2col = Math.min(1,df[0].length-1)
        if(checkNumber("x3col",x3col))
            x3col = parseFloat(x3col)
        else x3col = Math.min(2,df[0].length-1)
        
        if(x1col > df[0].length || x2col > df[0].length || x3col > df[0].length)
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

            x1col = Math.min(x1col,maximumColumn)
            x2col = Math.min(x2col,maximumColumn)
            x3col = Math.min(x3col,maximumColumn)
        }


        if(fraction < 1)
        {
            df = df.slice(0,df.length*fraction)
        }


        // automatic header detection
        if(options.header == undefined && df.length >= 2)
        {
            // find out automatically if they are headers or not
            // take x1col, check first line type (string/NaN?) then second line type (number/!NaN?)
            // if both are yes, it's probably header = true
            if(isNaN(df[0][x1col]) && !isNaN(df[1][x1col]))
            {
                console.log("detected headers, first csv line is not going to be plotted therefore. To prevent this, set header=false")
                header = true
            }
        }
        
        let headerRow
        if(header)
        {
            if(df.length == 1)
                return console.error("dataframe is empty besides headers")

            headerRow = df[0]
            // still set to default values?
            if(x1title == "x1")
                x1title = headerRow[x1col]
            if(x2title == "x2")
                x2title = headerRow[x2col]
            if(x3title == "x3")
                x3title = headerRow[x3col]
            // remove the header from the dataframe. Usually you would just change the starting pointer for
            // the array. don't know if something like that exists in javascript
            df = df.slice(1,df.length)
        }
        if(df.length == 0)
            return console.error("dataframe is empty")

        this.benchmarkStamp("checked Parameters")

        // only for scatterplot relevant at the moment. Going to be called when the mode is detected as scatterplot

        // plotDataFrame
        //-------------------------//
        //     coloring labels     //
        //-------------------------//
        // creates an array "dfColors" that holds the color information
        //(unnormalized numbers or color strings (#fff,rgb,hsl)) for each vertex (by index)

        // headers are already removed from df by now
        let colorMap = this.ColorManager.getColorMap(df,colorCol,defaultColor,labeled,header,filterColor,hueOffset)
        if(colorMap == -1)
        {
            // colorManager requests to restart "getColorMap" using labeled = true
            labeled = true
            options.labeled = labeled
            colorMap = this.ColorManager.getColorMap(df,colorCol,defaultColor,labeled,header,filterColor,hueOffset)
        }
        let dfColors = colorMap.dfColors

        // update the legend with the label color information
        // open legend, add title
        let legendHTML = ""
        if(title != undefined && title != "")
            legendHTML += "<h1>"+title+"</h1>"

        // add info about the labels and the colors
        if(colorMap.labelColorMap != {})
        {
            if(mode != "barchart") // no labels available in barchart mode (yet)
            {
                // label colors:
                legendHTML += "<table class=\"jsP3D_labelColorLegend\">" // can't append to innerHTML directly for some funny reason
                for(let key in colorMap.labelColorMap)
                {
                    legendHTML += "<tr>"
                    legendHTML += "<td><span class=\"jsP3D_labelColor\" style=\"background-color:#" + colorMap.labelColorMap[key].getHexString() + ";\"></span></td>"
                    legendHTML += "<td>" + key + "</td>"
                    legendHTML += "</tr>"
                }
                legendHTML += "</table>"
            }
        }

        // axes titles:
        legendHTML += "<table class=\"jsP3D_axesTitleLegend\">"
        if(x1title != undefined)
            legendHTML += "<tr><td>x:</td><td>"+x1title+"</td></tr>"
        if(x2title != undefined)
            legendHTML += "<tr><td>y:</td><td>"+x2title+"</td></tr>"
        if(x3title != undefined)
            legendHTML += "<tr><td>z:</td><td>"+x3title+"</td></tr>"
        legendHTML += "</table>"

        // closing tag of the legend
        this.legend.element.innerHTML = legendHTML
        this.benchmarkStamp("created the Legend")

        // by this point only dfColors stays relevant. So the function above can be easily moved to a different class to clear up the code here

        // plotDataFrame
        //-------------------------//
        //       normalizing       //
        //-------------------------//
        // finds out by how much the values (as well as colors) to divide and for the colors also a displacement


        // normalize, so that the farthest away point is still within the xLen yLen zLen frame
        // TODO logarithmic normalizing
 
        let startValueIndex = 0
        if(df.length >= 2)
            // assume second line if possible, because headers might be accidentally still there (because of wrong configuration)
            startValueIndex = 1

        let maxX1, minX1
        if(normalizeX1)
        {
            maxX1 = df[startValueIndex][x1col]
            minX1 = df[startValueIndex][x1col]
            // determine max for normalisation
            for(let i = 0; i < df.length; i++)
            {
                // in the df are only strings. Math.abs not only makes it positive, it also parses that string to a number
                if((df[i][x1col]) > maxX1)
                    maxX1 = df[i][x1col]
                if((df[i][x1col]) < minX1)
                    minX1 = df[i][x1col]
            }

            // take care of normalizing it together with the cached dataframe in case keepOldPlot is true
            if(keepOldPlot)
                for(let i = 0; i < this.dfCache.dataframe.length; i++)
                {
                    // in the df are only strings. Math.abs not only makes it positive, it also parses that string to a number
                    if(parseFloat(this.dfCache.dataframe[i][x1col]) > maxX1)
                        maxX1 = this.dfCache.dataframe[i][x1col]
                    if(parseFloat(this.dfCache.dataframe[i][x1col]) < minX1)
                        minX1 = this.dfCache.dataframe[i][x1col]
                }
            // a hybrid solution of checking the distance between the points and checking the |value|
            x1frac = Math.max(Math.abs(maxX1),Math.abs(minX1)) // based on largest |value|
            
        }
        
        if(mode != "barchart") // barcharts need their own way of normalizing x2, because they are the sum of closeby datapoints (interpolation) (and also old datapoints, depending on keepOldPlot)
        {
            if(normalizeX2)
            {
                let maxX2 = df[startValueIndex][x2col]
                let minX2 = df[startValueIndex][x2col]
                for(let i = 0; i < df.length; i++)
                {
                    if((df[i][x2col]) > maxX2)
                        maxX2 = df[i][x2col]
                    if((df[i][x2col]) < minX2)
                        minX2 = df[i][x2col]
                }

                // take care of normalizing it together with the cached dataframe in case keepOldPlot is true
                if(keepOldPlot)
                    for(let i = 0; i < this.dfCache.dataframe.length; i++)
                    {
                        // in the df are only strings. Math.abs not only makes it positive, it also parses that string to a number
                        if(parseFloat(this.dfCache.dataframe[i][x2col]) > maxX2)
                            maxX2 = this.dfCache.dataframe[i][x2col]
                        if(parseFloat(this.dfCache.dataframe[i][x2col]) < minX2)
                            minX2 = this.dfCache.dataframe[i][x2col]
                    }
                // a hybrid solution of checking the distance between the points and checking the |value|
                let a = Math.max(Math.abs(maxX2),Math.abs(minX2)) // based on largest |value|
                let b = Math.abs(maxX2-minX2) // based on distance between min and max
                x2frac = Math.max(a,b) // hybrid
            }
        }

        let maxX3, minX3
        if(normalizeX3)
        {
            maxX3 = df[startValueIndex][x3col]
            minX3 = df[startValueIndex][x3col]
            for(let i = 0; i < df.length; i++)
            {
                if((df[i][x3col]) > maxX3)
                    maxX3 = df[i][x3col]
                if((df[i][x3col]) < minX3)
                    minX3 = df[i][x3col]
            }
            
            // take care of normalizing it together with the cached dataframe in case keepOldPlot is true
            if(keepOldPlot)
                for(let i = 0; i < this.dfCache.dataframe.length; i++)
                {
                    // in the df are only strings. Math.abs not only makes it positive, it also parses that string to a number
                    if(parseFloat(this.dfCache.dataframe[i][x3col]) > maxX3)
                        maxX3 = this.dfCache.dataframe[i][x3col]
                    if(parseFloat(this.dfCache.dataframe[i][x3col]) < minX3)
                        minX3 = this.dfCache.dataframe[i][x3col]
                }
            // a hybrid solution of checking the distance between the points and checking the |value|
            x3frac = Math.max(Math.abs(maxX3),Math.abs(minX3)) // based on largest |value|
        }

        this.benchmarkStamp("normalized the data")

        if(mode == "barchart")
        {
            // plotDataFrame
            //-------------------------//
            //        Bar Chart        //
            //-------------------------//


            // how are negative positions created?
            //
            //                    -1
            //          +---------+---------+
            //          |         |         |
            //          |         |         |
            //          |         |         |
            //        -1|_________|_________|1
            //          |         |         |
            //          |         |         |
            //          |         |         |
            //          |         |         |
            //          +---------+---------+
            //                    1
            //
            //
            // this rectangle is being filled with invisible bars. Number of bars: (xVerticesCount * zVerticesCount)
            // how do i adress bars using negative numbers?
            // bar heights are stored in a 2D array. They are accessed using positive integers from 0 to xVerticesCount*2
            // I just have to add xVerticesCount and zVerticesCount to the array index to get the bar for e.g. (-5, 2).
            // Afterwards the whole group of bars just has to be translated by -xLen and -zLen so that the bar
            // at [xVerticesCount/2][zVerticesCount/2] is displayed in the middle upon rendering

            // this.dfCache.previousX2frac = 1 // for normalizationSmoothing. Assume that the data does not need to be normalized at first
            // let xBarOffset = 1/this.xRes/2
            // let zBarOffset = 1/this.zRes/2

            // helper function
            let createBar = (x,z,cubegroup) =>
            {
                // create the bar
                // I can't put 0 into the height parameter of the CubeGeometry constructor because if I do it will not construct as a cube
                let shape = new THREE.CubeGeometry((1-barchartPadding)/this.xRes,1,(1-barchartPadding)/this.zRes)
                // manually set the height to 0:
                shape.scale(1,0,1)

                // use translate when the position property should not be influenced
                // shape.translate(xBarOffset,0,zBarOffset)

                let plotmat = new THREE.MeshStandardMaterial({
                    color: 0,
                    emissive: 0,
                    emissiveIntensity: 1,
                    roughness: 1,
                    visible: false,
                    side: THREE.DoubleSide
                })

                let bar = new THREE.Mesh(shape,plotmat)
                bar.position.set(x/this.xRes,0,z/this.zRes)
                // as the bars height are caulcated using a huge offset of xVerticesCount+1 and zVerticesCount+1 in addToHeights, translate it back to its right position
                bar.geometry.translate(-(this.xVerticesCount+1)/this.xRes,0,-(this.zVerticesCount+1)/this.zRes) // use translate when the position property should not be influenced
                cubegroup.add(bar)

                return bar
            }


            // if needed, reconstruct the barchart
            let valid = this.IsPlotmeshValid("barchart")
            // shape of bars changed? recreate from scratch
            let paddingValid = (options.barchartPadding == undefined && this.dfCache.options.barchartPadding == undefined) || (barchartPadding == this.dfCache.options.barchartPadding)

            if(!valid || !paddingValid)
            {
                this.disposeMesh(this.plotmesh)
                this.dfCache.barsGrid = undefined
                
                // into this group fill the bars
                let cubegroup = new THREE.Group()
                cubegroup.name = "barchart"
                
                // dimensions of the bars
                /*let barXWidth = 1/this.xRes
                let barZWidth = 1/this.zRes
                if(barchartPadding > barXWidth || barchartPadding > barZWidth)
                    console.warn("barchartPadding might be too large. Try a maximum value of "+Math.min(barXWidth,barZWidth))*/

                this.plotmesh = cubegroup
                this.scene.add(cubegroup)
            }

            let barsGrid = this.dfCache.barsGrid
            if(barsGrid == undefined)
            {
                // now create an array that has one element for each bar. Bars are aligned in a grid of this.xRes and this.zRes elements
                // make it 4 times as large (*2 and *2) so that it can hold negative numbers
                barsGrid = new Array((this.xVerticesCount+1)*2)
                for(let x = 0; x < barsGrid.length; x++)
                {
                    barsGrid[x] = new Array((this.zVerticesCount+1)*2)
                    for(let z = 0; z < barsGrid[x].length; z++)
                    {
                        barsGrid[x][z] = {}
                        barsGrid[x][z].y = 0
                    }
                }
                this.dfCache.barsGrid = barsGrid
            }


            // overwrite with zeros, reset
            if(!keepOldPlot)
            {
                for(let x = 0; x < barsGrid.length; x++)
                {
                    for(let z = 0; z < barsGrid[x].length; z++)
                    {
                        barsGrid[x][z].y = 0
                        this.disposeMesh(barsGrid[x][z].bar)
                    }
                }
            }
            

            // fill the barsGrid array with the added heights of the bars
            // get a point from the dataframe. Calculate the coordinates from that.
            // to do this, the value has to be brought down to the normalized value (/x1frac). It now has maximum values of [-1, +1].
            // multiply by xVerticesCount, to get maximum values of [-xVerticesCount, +xVerticesCount]. Now apply the offset of +xVerticesCount to transform it to
            //[0, 2*xVerticesCount]
            // afterwards get that to an array index. remember, that the array has some parts reserved for negative x and z values by using an offset
            // so, divide x_float by x1frac and multiply it by xVerticesCount.
            // x_float = df[i][x1col]/x1frac*xVerticesCount = df[i][x1col]/(x1frac/xVerticesCount) = df[i][x1col]*(xVerticesCount/x1frac) = df[i][x1col]*xVerticesCount/x1frac
            let factorX1 = (this.xVerticesCount)/x1frac
            let factorX3 = (this.zVerticesCount)/x3frac

            // use the maximums from the recent run if keepOldPlot
            let maxX2 = this.dfCache.maxX2
            let minX2 = this.dfCache.minX2
            if(minX2 == undefined || maxX2 == undefined || !keepOldPlot)
            {
                maxX2 = barsGrid[0][0].y
                minX2 = barsGrid[0][0].y
            }

            // helper function for interpolation
            let addToHeights = (x, y, z, x_float, z_float) =>
            {
                /**
                 *       a +----------+ b
                 *         |     |    |
                 *         |-----+    |
                 *         |     e    |
                 *         |          |
                 *       c +----------+ d
                 */
                // example: calculate how much to add of y to pixel d. e has the coordinates x_float and z_float
                // calculate the area of the rectangle (called let oppositeSquare) between a (coordinates x and z) and e and multiply that by y
                // that result can be added to [value y of d]
                // small rectangle => small area => small change for d
                // large rectangle => large area => change value at d by a lot
                
                let oppositeSquareArea = Math.abs(1-Math.abs(x-x_float))*(1-Math.abs(z-z_float))

                if(oppositeSquareArea == 0)
                    return

                // make sure x and z are not out of bounds (should not happen!)
                if(barsGrid[x] != undefined)
                    if(barsGrid[x][z] != undefined)
                    {
                        // update the heights
                        barsGrid[x][z].y += y*oppositeSquareArea // initialized with 0, now +=
                        //+=, because otherwise it won't interpolate. It has to add the value to the existing value
                        
                        // find the highest bar
                        // even in case of normalizeX2 being false, do this, so that the heatmapcolor can be created
                        if(barsGrid[x][z].y > maxX2)
                            maxX2 = barsGrid[x][z].y
                        if(barsGrid[x][z].y < minX2)
                            minX2 = barsGrid[x][z].y

                        // if needed create the bar
                        if(barsGrid[x][z].bar == undefined)
                            barsGrid[x][z].bar = createBar(x,z,this.plotmesh)
                        
                        return
                    }
                console.error(x,z,"is not defined in",barsGrid,
                    "this is a bug. This might happen because the code tries to interpolate beyond the "+
                    "bounds of the grid, but this normally should not be the case."
                )
            }

            // don't get fooled and write code here and suspect it to run after the
            // normalization. Write it below the loop that calls addToHeights

            for(let i = 0; i < df.length; i ++)
            {

                // INTERPOLATE

                // get coordinates that can fit into an array
                // interpolate. When x and z is at (in case of parseFloat) e.g. 2.5,1. Add one half to 2,1 and the other hald to 3,1 
                
                // add the following, because the array is twice as large and the center is supposed to be at [xVertCount][zVertCount]
                let x_float = df[i][x1col]*factorX1 + this.xVerticesCount+1
                let z_float = df[i][x3col]*factorX3 + this.zVerticesCount+1
                
                let x_le = Math.floor(x_float) // left
                let z_ba = Math.floor(z_float) // back

                let y = (df[i][x2col]) // don't normalize yet

                // if x_float and z_float it somewhere inbewteen
                if(x_float != x_le || z_float != z_ba)
                {

                    addToHeights(x_le, y, z_ba, x_float, z_float)

                    let x_ri = x_le+1 // right
                    let z_fr = z_ba+1 // front

                    addToHeights(x_ri, y, z_ba, x_float, z_float)
                    addToHeights(x_le, y, z_fr, x_float, z_float)
                    addToHeights(x_ri, y, z_fr, x_float, z_float)
                }
                else
                {
                    // otherwise I can just plot it a little bit cheaper,
                    // when x_float and z_float perfectly aligns with the grid
                    addToHeights(x_le, y, z_ba, x_float, z_float)
                }
            }

            // update write back
            this.dfCache.maxX2 = maxX2
            this.dfCache.minX2 = minX2

            // percent of largest bar
            barSizeThreshold = barSizeThreshold*Math.max(Math.abs(maxX2),Math.abs(minX2))

            if(normalizeX2 == true)
            {
                let a = Math.max(Math.abs(maxX2),Math.abs(minX2)) // based on largest |value|
                let b = Math.abs(maxX2-minX2) // based on distance between min and max
                x2frac = Math.max(a,b) // hybrid
                // a lower value of normalizationSmoothing will result in faster jumping around plots. 0 Means no smoothing this happens, because 
                // sometimes the plot might be close to 0 everywhere. This is not visible because of the normalization though one the sign
                // changes, it will immediatelly jump to be normalized with a different sign. To prevent this one can smoothen the variable x2frac
                // x2frac = (x2frac + normalizationSmoothing*this.dfCache.previousX2frac)/(normalizationSmoothing+1)
                // this.dfCache.previousX2frac = x2frac
                // this is a little bit too experimental at the moment. Once everything runs properly stable it's worth thinking about it
            }

            // now color the children & normalize
            for(let x = 0; x < barsGrid.length; x++)
            {
                for(let z = 0; z < barsGrid[x].length; z++)
                {
                    let bar = barsGrid[x][z].bar
                    if(bar != undefined)
                    {
                        let y = barsGrid[x][z].y
                        
                        let color = this.ColorManager.convertToHeat(y,minX2,maxX2,hueOffset)
                        bar.material.color.set(color)
                        bar.material.emissive.set(color)

                        // hide that bar if it's smaller than or equal to the threshold
                        // y is now normalized (|y| is never larger than 1), so barSizeThreshold acts like a percentage value
                        if(Math.abs(y) > barSizeThreshold)
                        {
                            // make it visible if it's not zero
                            bar.material.visible = true
                            // no need to recompute normals, because they still face in the same direction
                        }
                        else
                        {
                            bar.material.visible = false
                        }

                        y = y/x2frac*this.yLen
                        
                        // those are the vertex of the barchart that surround the top face
                        bar.geometry.vertices[0].y = y
                        bar.geometry.vertices[1].y = y
                        bar.geometry.vertices[4].y = y
                        bar.geometry.vertices[5].y = y
        
                        bar.geometry.verticesNeedUpdate = true
                    }
                }
            }

            this.benchmarkStamp("made a bar chart")
        }
        else if(mode == "polygon")
        {

            // plotDataFrame
            //-------------------------//
            //       3D-Mesh Plot      //
            //-------------------------//

            // I unfortunatelly think this can't work

            //(as long as the datapoint coordinates are not grid like.)
            // if they are, the code would have to detect the resolution and then an easy algorithm can be run over the
            // datapoints to connect triangles with the nearest vertices and leave those out that are not existant

            // I could try to align the datapoints to a grid and maybe even interpolating it, but when there are only few datapoints
            // in some parts of the "landscape", there won't be a polygon created, because there would still be spaces in the grid

            // the only way i can think of would be a "density based clustering like with a dynamic radius" kind of approach that checks for intersections
            // because edges should not cross each other. It would be ridiculously complex and I really don't have the time for that during my studies

            // one could also:
            // 1. align the scattered datapoints to a grid (interpolated, that means add the datapoints y-value to nearby grid positions mulitplied with (1-distance))
            //2. connect triangles when datapoints are directly next to each other (go clockwise around the grid positions that are one step away)
            //3. datapoints that are still don't connected to anything receive a circle sprite OR connect themself to the 2 nearest vertices
            // the grid resolution would determine how well the polygon can connect


        }
        else if(mode == "linechart")
        {

            // plotDataFrame
            //-------------------------//
            //        lineplot         //
            //-------------------------//

            // iterate over dataframe datapoints, connect the latest point with the new one
            //  +---+---+---+--> +   +   +
            // it goes zig zag through the 3D Space


        }
        else
        {

            // plotDataFrame
            //-------------------------//
            //       scatterplot       //
            //-------------------------//
            // This is the default mode
            

            if(mode != "scatterplot" && mode != undefined)
                console.warn("mode \""+mode+"\" unrecognized. Assuming \"scatterplot\"")
    
            if(!keepOldPlot)
            {
                this.disposeMesh(this.plotmesh)
            }

            let isItValid = this.IsPlotmeshValid("scatterplot")
            let oldMaterialDefined = this.dfCache != undefined && this.dfCache.material != undefined
            let isOldMaterialSimilar = (this.dfCache != undefined && this.dfCache.material != undefined && dataPointSize == this.dfCache.material.size)

            if(!oldMaterialDefined || !isItValid || !isOldMaterialSimilar)
            {
                // create a new material
                let canvas = document.createElement("canvas")
                let context = canvas.getContext("2d")
                canvas.width = 64
                canvas.height = 64
          
                context.beginPath()
                context.arc(32, 32, 30, 0, 2*Math.PI)
                context.fillStyle = "white"
                context.fill()
        
                let datapointSprite = new THREE.Texture(canvas)
                datapointSprite.needsUpdate = true
                // plot it using circle sprites

                datapointSprite.magFilter = THREE.LinearFilter
                datapointSprite.minFilter = THREE.LinearFilter


                // https:// github.com/mrdoob/three.js/issues/1625
                // alphaTest = 1 causes errors
                // alphaTest = 0.9 edgy picture
                // alphaTest = 0.1 black edges on the sprite
                // alphaTest = 0 not transparent infront of other sprites anymore
                // sizeAttenuation: false, sprites don't change size in distance and size is in px
                let material = new THREE.PointsMaterial({
                    size: dataPointSize,
                    map: datapointSprite,
                    alphaTest: 0.3,
                    transparent: true,
                    vertexColors: true
                })

                this.dfCache.material = material
                this.plotmesh = new THREE.Group()
                this.plotmesh.name = "scatterplot"
            }

            let material = this.dfCache.material
            let group = this.plotmesh
            let geometry = new THREE.Geometry()
            
            for(let i = 0; i < df.length; i ++)
            {
                let vertex = new THREE.Vector3()
                vertex.x = df[i][x1col]/x1frac*this.xLen
                vertex.y = df[i][x2col]/x2frac*this.yLen
                vertex.z = df[i][x3col]/x3frac*this.zLen

                // three.js handles invalid vertex already by skipping them
                geometry.vertices.push(vertex)
                geometry.colors.push(dfColors[i])
            }

            let newDataPointSprites = new THREE.Points(geometry, material)

            
            this.plotmesh = group
            group.add(newDataPointSprites)
            this.scene.add(group)
            this.benchmarkStamp("made a scatterplot")
        }
        
        
        // plotDataFrame
        //-------------------------//
        //         Caching         //
        //-------------------------//
        // used for addDataPoint to store what was plotted the last time
        // also used to store the material in some cases so that it does not have to be recreated each time

        // now that the script arrived here, store the options to make easy redraws possible
        // update cache
        if(updateCache == true) // if updating is allowed
        {
            if(headerRow != undefined)
                this.dfCache.dataframe = ([headerRow]).concat(df)
            else
                this.dfCache.dataframe = df

            this.dfCache.x1col = x1col
            this.dfCache.x2col = x2col
            this.dfCache.x3col = x3col

            this.dfCache.options = options
        }

        this.makeSureItRenders()
    }



    /**
     * repeats the drawing using dfCache, but adds a new datapoint to it
     * @param {any} newDatapoint String or Array
     * @param {object} options
     * - mode {string}: "barchart" or "scatterplot"
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
     * - x1frac {number}: by how much to divide the datapoints x1 value to fit into [-1;1]
     * - x2frac {number}: by how much to divide the datapoints x2 value (y) to fit into [-1;1]
     * - x3frac {number}: by how much to divide the datapoints x3 value to fit into [-1;1]
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.02
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     */
    addDataPoint(newDatapoint,options={})
    {
        if(this.dfCache == undefined)
            this.resetCache()
            
        // overwrite old options
        for(let key in options)
            this.dfCache.options[key] = options[key]

        // default keepOldPlot, but make it possible to overwrite it.
        this.dfCache.options.keepOldPlot = true // true, so that the old plot gets extended with the new datapoint
        if(options.keepOldPlot != undefined)
            this.dfCache.options.keepOldPlot = options.keepOldPlot

        // the following have to be like this:
        this.dfCache.options.header = false // no header in newDataPoint
        this.dfCache.options.updateCache = false // false, because don't delete the original dataframe from cache

        // performance friendly default values
        if(options.normalizeX1 == undefined)
            this.dfCache.options.normalizeX1 = false
        if(options.normalizeX2 == undefined)
            this.dfCache.options.normalizeX2 = false
        if(options.normalizeX3 == undefined)
            this.dfCache.options.normalizeX3 = false
        // if(this.dfCache.options.normalizeX1 == true || this.dfCache.options.normalizeX2 == true || this.dfCache.options.normalizeX3 == true)
        //    console.warn("normalization for addDataPoint might be unperformant. You can change normalization using normalizeX1: false, normalizeX2: false, normalizeX3: false")

        // create the datapoint data structure (an array) from this
        if(typeof(newDatapoint) == "string")
        {
            newDatapoint = newDatapoint.split(this.dfCache.separator)
            for(let i = 0;i < newDatapoint.length; i++)
                newDatapoint[i] = newDatapoint[i].trim()
        }

        // create a new dataframe from scratch if non existant
        this.dfCache.dataframe[this.dfCache.dataframe.length] = newDatapoint
        
        if(newDatapoint.length != this.dfCache.dataframe[0].length)
            return console.error("the new datapoint does not match the number of column in the cached dataframe ("+newDatapoint.length+" != "+this.dfCache.dataframe[0].length+")")

        // because of keepOldPlot, only hand the newDatapoint over to plotDataFrame
        this.plotDataFrame([newDatapoint],
            this.dfCache.x1col,
            this.dfCache.x2col,
            this.dfCache.x3col,
            this.dfCache.options, // dfCache.options got overwritten in this function
            true)

        return 0
    }



    /**
     * appends the legend to a specific container. Make sure tostyle it because otherwise the colored span elements will not be visible.
     * @param {DOM} container
     * @return returns the dom element of the legend
     */
    createLegend(container)
    {
        if(container == null || container == undefined)
            return console.error("container for createLegend not found")
        container.appendChild(this.legend.element)
        return(this.legend.element)
    }



    /**
     * sometimes it renders sometimes it does not (static images)
     * super problematic. Make sure it gets rendered by using some timeouted renders
     */
    makeSureItRenders()
    {
        // if animated, don't render it here. In callAnimation it's going to render
        if(this.animationFunc == undefined)
        {
            for(let i = 0;i < 5; i++)
                window.setTimeout(()=>this.render(),100+i*33)
            for(let i = 0;i < 5; i++)
                window.setTimeout(()=>this.render(),(100+5*33)+i*66)
        }
    }



    /**
     * if plotmesh is invalid it gets clered. The point of this is that materials and such don't have to be recreated again and again
     * It checks the mesh.type, mesh.name and mesh.geometry.type if it matches with the parameter check
     * @return returns true if plotmesh is still valid and existant
     */
    IsPlotmeshValid(check)
    {
        let obj = this.plotmesh

        if(obj == undefined)
        {
            this.redraw = false
            return false
        }
            
        // it either has children because it's a group it has a geometry. if both are undefined, it's not valid anymore.

        if(this.redraw == true) // this is the only place where this.redraw is taken into account
        {
            this.disposeMesh(obj)
            this.redraw = false
            return false
        }


        if(obj.name == check)
            return true

        if(obj.type == check)
            return true

            
        this.disposeMesh(obj)
        this.redraw = false
        return false
    }



    /**
     * clears the cache and initializes it
     */
    resetCache()
    {
        this.dfCache = {}
    
        this.dfCache.material = undefined
        this.dfCache.dataframe = []
        this.dfCache.x1col = 0
        this.dfCache.x2col = 1
        this.dfCache.x3col = 2
        this.dfCache.checkstring = ""
        this.dfCache.options = {}
        this.dfCache.minX2 = undefined
        this.dfCache.maxX2 = undefined
        this.dfCache.barsGrid = []
    }



    /**
     * returns the cache
     */
    getCache()
    {
        if(this.dfCache == undefined)
            resetCache()
        return this.dfCache
    }



    /**
     * frees memory and removes the plotmesh (by making it available for the garbage collegtor)
     */
    disposeMesh(mesh)
    {   
        if(mesh != undefined)
        {
            if(mesh.geometry != undefined)
                mesh.geometry.dispose()
            if(mesh.material != undefined)
                mesh.material.dispose()
            if(mesh.texture != undefined)
                mesh.texture.dispose()

            // recursively clear the children
            for(let i = 0;i < mesh.children.length; i++)
                this.disposeMesh(mesh.children[i])
                
            if(mesh.parent != null)
                mesh.parent.remove(mesh)
                
            if(mesh != undefined)
                mesh.remove()
        }
    }


    /**
     * changes the background color and triggers a rerender
     * @param {string} color
     */
    setBackgroundColor(color)
    {
        let colorObject = this.ColorManager.getColorObjectFromAnyString(color)
        if(colorObject != undefined)
            this.renderer.setClearColor(this.ColorManager.getColorObjectFromAnyString(color))
        else
            this.renderer.setClearColor(color)
        this.render()
    }



    /**
     * Creates new axes with the defined color and triggers a rerender
     * @param {String} color     hex string of the axes color
     */
    setAxesColor(color)
    {
        this.createAxes(color)
        this.render()
    }



   /**
     * sets the container of this plot
     * @memberof Plot
     * @param {object} container DOM-Element of the new container
     */
    setContainer(container)
    {
        if(typeof(container) != "object")
            return console.error("param of setContainer (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")

        this.container = container
        this.renderer.setSize(container.offsetWidth,container.offsetHeight)

        this.container.appendChild(this.renderer.domElement)
    }



    /**
     * gets the DOM container of this plot
     * @return {object} the DOM-Element that contains the plot
     */
    getContainer()
    {
        return this.container
    }



    /**
     * @param {object} dimensions json object can contain the following:
     * - xRes number of vertices for the x-axis
     * - zRes number of vertices for the z-axis
     * - xLen length of the x-axis. This is for the frame for data normalisation and formula plotting
     * - yLen length of the y-axis. This is for the frame for data normalisation and formula plotting
     * - zLen length of the z-axis. This is for the frame for data normalisation and formula plotting
     * TODO set offset of the plot
     */
    setDimensions(dimensions)
    {
        if(typeof(dimensions) != "object")
            return console.error("param of setDimensions (dimensions) should be a json object containing at least one of xRes, zRes, xLen, yLen or zLen")

        if(dimensions.xRes != undefined)
            this.xRes = Math.max(1,Math.abs(parseInt(dimensions.xRes)))
        if(dimensions.zRes != undefined)
            this.zRes = Math.max(1,Math.abs(parseInt(dimensions.zRes)))
        if(dimensions.xLen != undefined)
            this.xLen = Math.abs(dimensions.xLen)
        if(dimensions.yLen != undefined)
            this.yLen = Math.abs(dimensions.yLen)
        if(dimensions.zLen != undefined)
            this.zLen = Math.abs(dimensions.zLen)

        this.xVerticesCount = Math.max(1,Math.round(this.xLen*this.xRes))
        this.zVerticesCount = Math.max(1,Math.round(this.zLen*this.zRes))

        if(this.axes != undefined)
            this.createAxes(this.axesColor) // recreate
        
        if(this.camera != undefined && this.cameraControls != undefined)
        {
            // move
            this.camera.position.set(this.xLen/2,Math.max(this.zLen,this.yLen),this.zLen+this.xLen)
            this.cameraControls.target.set(this.xLen/2,this.yLen/2,this.zLen/2)
            this.camera.lookAt(this.cameraControls.target)
        }

        // vertices counts changed, so the mesh has to be recreated
        this.redraw = true

        // takes effect once the mesh gets created from new, except for the lengths indicated by the axes. those update immediatelly
        this.render()
    }



    /**
     * returns a JSON object that contains the dimensions
     * TODO print also min and max x, y and z (offset of the plot)
     * @return {object} {xRes, zRes, xLen, yLen, zLen}
     */
    getDimensions()
    {
        return {
            xRes: this.xRes,
            zRes: this.zRes,
            xLen: this.xLen,
            yLen: this.yLen,
            zLen: this.zLen
        }
    }



    /**
     * Deprecated
     * changes the datapoint image. You need to plot the data again after this function so that the change takes effect
     * @param {string} url url of the image.
     */
    /*setDataPointImage(url)
    {
        console.log("url: "+typeof(url))
        this.dataPointImage = url
    }*/



    /**
     * reinitializes the variables that are needed for calculating plots, so that a new plot can be started
     * @private
     */
    resetCalculation()
    {
        this.calculatedPoints = new Array(this.xVerticesCount)
        for(let i = 0;i < this.calculatedPoints.length; i++)
            this.calculatedPoints[i] = new Array(this.zVerticesCount)

        this.parsedFormula = ""
        this.stopRecursion = false
    }



    /**
     * updates what is visible on the screen.
     */
    render()
    {
        this.renderer.render(this.scene, this.camera)
    }



    /**
     * tells this object to animate this. You can stop the animation using stopAnimation()
     * @example
     * 
     *      var i = 0;
     *      plot.animate(function() {
     *              i += 0.01;
     *              plot.plotFormula("sin(2*x1+i)*sin(2*x2-i)","barchart");
     *      }.bind(this))
     * @param {function} animationFunc
     */
    animate(animationFunc)
    {
        this.onChangeCamera = function() {}
        this.animationFunc = animationFunc
        this.callAnimation()
    }



    /**
     * stops the ongoing animation. To start an animation, see animate(...)
     */
    stopAnimation()
    {
        this.animationFunc = ()=>{}
    }



    /**
     * executes the animation. Use animate(...) if you want to set up an animation
     * @private
     */
    callAnimation()
    {
        if(this.animationFunc != undefined)
        {
            this.animationFunc()
            this.render()
        }
        requestAnimationFrame(()=>this.callAnimation())
    }



    /**
     * enables benchmarking. Results will be printed into the console.
     * To disable it, use: disableBenchmarking(). To print a timestamp to the console, use  this.benchmarkStamp("foobar")
     */
    enableBenchmarking()
    {
        this.benchmark = {}
        this.benchmark.enabled = true
        this.benchmark.recentTime = -1 // tell  this.benchmarkStamp() to write the current time into recentResult
    }



    /**
     * disables benchmarking. To enable it, use: enableBenchmarking(). To print a timestamp to the console, use  this.benchmarkStamp("foobar")
     */
    disableBenchmarking()
    {
        this.benchmark = {}
        this.benchmark.enabled = false
    }



    /**
     * prints time and an identifier to the console, if enabled
     * @param {string} identifier printed at the beginning of the line
     */
    benchmarkStamp(identifier)
    {
        if(this.benchmark == undefined)
            return

        if(this.benchmark.recentTime == -1)
            this.benchmark.recentTime = window.performance.now()

        if(this.benchmark.enabled == true)
        {
            console.log(identifier+": "+(window.performance.now()-this.benchmark.recentTime)+"ms")
            this.benchmark.recentTime = window.performance.now()
        }
    }


    /** Creates the camera
     * @private
     */
    createArcCamera()
    {
        let width = this.container.offsetWidth
        let height = this.container.offsetHeight

        let viewAngle = 80
        let aspect = width / height
        let near = 0.05 // when objects start to disappear at zoom-in
        let far = 20 // when objects start to disappear at zoom-out
        let camera = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)
        // let zoom = 1000
        // let camera = new THREE.OrthographicCamera(width/-zoom, width/zoom, height/-zoom, height/zoom, near, far)
        camera.position.set(this.xLen/2,Math.max(this.zLen,this.yLen),this.zLen+this.xLen)

        let controls = new OrbitControls(camera, this.renderer.domElement)
        controls.enableKeys = false
        controls.target.set(0.5,0.5,0.5)

        // the point of this is, that i can disable this by overwriting it
        // when doing animations no need to use the event listener anymore
        this.onChangeCamera = function()
        {
            this.render()
        }
        controls.addEventListener("change", ()=>this.onChangeCamera())

        controls.enableDamping = true
        controls.dampingFactor = 0.25
        controls.enableZoom = true
        controls.rotateSpeed = 0.3
        controls.maxDistance = 5
        controls.minDistance = 0.3

        // start looking at the target initially
        camera.lookAt(controls.target)

        this.camera = camera
        this.cameraControls = controls
    }



    /**
     * takes care of creating the light
     * @private
     */
    createLight()
    {
        // set a directional light
        let color1 = 0xff9933
        let color2 = 0x0033ff
        let directionalLight1 = new THREE.DirectionalLight(color1, 0.3)
        directionalLight1.position.y = 10;
        this.scene.add(directionalLight1)
        let directionalLight2 = new THREE.DirectionalLight(color2, 0.3)
        directionalLight2.position.y = -10;
        this.scene.add(directionalLight2)
    }



    /**
     * removes the axes. They can be recreated using createAxes(color)
     */
    removeAxes()
    {
        this.disposeMesh(this.axes)
        this.axes = undefined
    }


    /**
     * creates the axes that point into the three x, y and z directions as wireframes
     * @private
     * @param {string} color     hex string of the axes color. default black #000000
     */
    createAxes(color="#000000")
    {
        this.axesColor = color // to be able to easily redraw it later with the same color
        this.disposeMesh(this.axes)

        let axes = new THREE.Group()
        let percentage = 1.1 // how long the axes are to xLen, yLen and zLen

        let colorObject = this.ColorManager.getColorObjectFromAnyString(color)
        if(colorObject != undefined)
            color = colorObject


        // lines that point into the dimensions
        let axesWireGeom = new THREE.Geometry()
        let cent = new THREE.Vector3(0,0,0)
        let xend = new THREE.Vector3(this.xLen*percentage,0,0)
        let yend = new THREE.Vector3(0,this.yLen*percentage,0)
        let zend = new THREE.Vector3(0,0,this.zLen*percentage)
        axesWireGeom.vertices.push(cent) // 0
        axesWireGeom.vertices.push(xend) // 1
        axesWireGeom.vertices.push(yend) //2
        axesWireGeom.vertices.push(zend) //3
        axesWireGeom.faces.push(new THREE.Face3(0,0,1))
        axesWireGeom.faces.push(new THREE.Face3(0,0,2))
        axesWireGeom.faces.push(new THREE.Face3(0,0,3))
        // wireframe and color those paths
        let axesWireMat = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            side: THREE.DoubleSide
          });
        let axesWire = new THREE.Mesh(axesWireGeom, axesWireMat)
        axes.add(axesWire)


        // arrows that sit at the end of the lines
        let arrowMat = new THREE.MeshBasicMaterial({
            color: color
        });
        let arrowGeom = new THREE.ConeGeometry(0.02,0.066,12)
        let arrowMesh1 = new THREE.Mesh(arrowGeom, arrowMat)
        let arrowMesh2 = new THREE.Mesh(arrowGeom, arrowMat)
        let arrowMesh3 = new THREE.Mesh(arrowGeom, arrowMat)
        arrowMesh1.rotateZ(-Math.PI/2)
        arrowMesh3.rotateX(Math.PI/2)
        arrowMesh1.position.set(this.xLen*percentage,0,0)
        arrowMesh2.position.set(0,this.yLen*percentage,0)
        arrowMesh3.position.set(0,0,this.zLen*percentage)
        axes.add(arrowMesh1)
        axes.add(arrowMesh2)
        axes.add(arrowMesh3)

        let placeLetter = function(letter, textColor, position)
        {
            // write text to a canvas
            let textCanvas = document.createElement('canvas')
            textCanvas.height = 128
            textCanvas.width = 64
            let context2d = textCanvas.getContext('2d')
            context2d.font = "Bold 80px sans-serif"
            context2d.fillStyle = textColor // textclr
            context2d.fillText(letter,0,80) // write
    
            // create a texture from the canvas
            let canvasToTexture = new THREE.Texture(textCanvas)
            let textureToSprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: canvasToTexture,
                alphaTest: 0.6
            }))
    
            // transform
            let size = 0.05
            textureToSprite.scale.set(size,2*size)
            textureToSprite.position.set(position.x,position.y,position.z)
    
            // finish
            canvasToTexture.needsUpdate = true
            return textureToSprite
        }

        // text indicating the dimension name
        let offset = 0.1
        let xLetter = placeLetter("x","#"+colorObject.getHexString(), new THREE.Vector3(this.xLen*percentage+offset,0,0))
        let yLetter = placeLetter("y","#"+colorObject.getHexString(), new THREE.Vector3(0,this.yLen*percentage+offset,0))
        let zLetter = placeLetter("z","#"+colorObject.getHexString(), new THREE.Vector3(0,0,this.zLen*percentage+offset))
        axes.add(xLetter)
        axes.add(yLetter)
        axes.add(zLetter)


        // add the axes group to the scene and store it locally in the object
        this.scene.add(axes)
        this.axes = axes
    }




    /**
     * function that is used when calculating the x3 values f(x1, x3)
     * @private
     * @param {number} x1        x1 value in the coordinate system
     * @param {number} x3        x3 value in the coordinate system
     */
    f(x1, x3)
    {
        return this.MathParser.eval2(this.parsedFormula, x1, x3, this.frec.bind(this))
    }



    /**
     * helper for f(x1,x3) in case there is recursion
     * @private
     * @param {number} x1        x1 value in the coordinate system
     * @param {number} x3        x3 value in the coordinate system
     */
    frec(x1, x3)
    {
        if(x1 < 0 || x3 < 0 || x1 > this.xLen || x3 > this.zLen)
            return 0

        // checking for a point if it has been calculated already increases the performance and
        // reduces the number of recursions.

        let val = this.calculatedPoints[parseInt(x1*this.xRes)][parseInt(x3*this.zRes)]

        if(val == undefined) // has this point has already been calculated before?
        {
            if(!this.stopRecursion)
                // bind f it to this, so that it can access this.calculatedPoints, this.xLen and this.zLen, this.stopRecursion
                // another solution would be probably if I would just hand the variables over to MathParser
                val = this.MathParser.eval2(this.parsedFormula, x1, x3, this.frec.bind(this))

            this.calculatedPoints[parseInt(x1*this.xRes)][parseInt(x3*this.zRes)] = val
        }

        // val might return NaN for Math.sqrt(-1)
        // that's fine. Handle this case in the loops that plot the function

        return val
    }
}
