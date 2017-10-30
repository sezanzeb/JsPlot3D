/**
 * Plots Dataframes and Formulas into a 3D Space
 * @module JsPlot3D
 */

import MathParser from "./MathParser.js"
import SceneHelper from "./SceneHelper.js"
import scatterplot from "./plotModes/Scatterplot.js"
import lineplot from "./plotModes/Lineplot.js"
import barchart from "./plotModes/Barchart.js"
import * as COLORLIB from "./ColorLib.js"
import * as THREE from "three"

// make the COLORLIB available as member of this module
export const colorLib = COLORLIB
export const XAXIS = 1
export const YAXIS = 2
export const ZAXIS = 3
export const SCATTERPLOT_MODE = "scatterplot"
export const BARCHART_MODE = "barchart"
export const LINEPLOT_MODE = "lineplot"
export const POLYGON_MODE = "polygon"
export const TOPCAMERA = 1
export const DEFAULTCAMERA = 0


export class Plot
{
    /**
     * Creates a Plot instance, so that a single canvas can be rendered. After calling this constructor, rendering can
     * be done using plotFormula(s), plotCsvString(s) or plotDataFrame(df)
     * @param {object} container html div DOM element which can then be selected using document.getElementById("foobar") with foobar being the html id of the container
     * @param {json} sceneOptions optional. at least one of backgroundColor or axesColor in a Json Format {}. Colors can be hex values "#123abc" or 0x123abc, rgb and hsl (e.g. "rgb(0.3,0.7,0.1)")
     */
    constructor(container, sceneOptions ={})
    {
        
        // parameter checking
        if(typeof(container) != "object")
            return console.error("second param for the Plot constructor (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")

        // The order of the following tasks is important!

        // initialize cache object
        this.clearOldData()

        // scene helper is needed for setContainer
        this.SceneHelper = new SceneHelper({width: container.offsetWidth, height: container.offsetHeight})

        // first set up the container and the dimensions
        this.setContainer(container)
        // don't use setDimensions for the following, as setDimensions is meant
        // to be something to call during runtime and will therefore cause problems
        this.dimensions = {xRes:20, zRes:20, xLen:1, yLen:1, zLen:1}
        this.dimensions.xVerticesCount = this.dimensions.xRes * this.dimensions.xLen
        this.dimensions.zVerticesCount = this.dimensions.zRes * this.dimensions.zLen
        
        // before MathParser, Dimensions have to be called to initialize some stuff (xVerticesCount and zVerticesCount)
        this.MathParser = new MathParser(this)

        // then setup the children of the scene (camera, light, axes)
        this.SceneHelper.createScene(this.dimensions, sceneOptions, {width: container.offsetWidth, height: container.offsetHeight})
        this.SceneHelper.centerCamera(this.dimensions) // set camera position

        // they need to be updated once setDimensions is called or the mode of the plot changes
        // why on modechange? because barcharts need a different way of displaying them due to the different
        // normalization approach
        this.axesNumbersNeedUpdate = false

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

        // now render the empty space (axes will be visible)
        this.SceneHelper.render()
    }




    /**
     * plots a formula into the container as 3D Plot
     * @param {string} originalFormula string of formula
     * @param {object} options json object with one or more of the following parameters:
     * - mode {string}: "barchart", "scatterplot", "polygon" or "lineplot"
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
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateOldData {boolean}: if false, don't overwrite the dataframe that is stored in the oldData-object
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0  
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */
    plotFormula(originalFormula, options ={})
    {

        let mode = "polygon"
        let x2frac = 1
        let normalizeX2 = true
        
        if(options.mode != undefined) mode = options.mode
        if(options.x2frac != undefined) x2frac = options.x2frac
        if(options.normalizeX2 != undefined) normalizeX2 = options.normalizeX2

        if(originalFormula == undefined || originalFormula === "")
            return console.error("first param of plotFormula (originalFormula) is undefined or empty")
        if(typeof(originalFormula) != "string")
            return console.error("first param of plotFormula (originalFormula) should be string")

        this.MathParser.resetCalculation()
        this.MathParser.parse(originalFormula) //tell the MathParser to prepare so that f can be executed
        this.oldData.checkstring = "" // don't fool plotCsvString into believing the oldData-object contains still old csv data

        if(mode === "scatterplot")
        {
            
            //plotFormula
            //-------------------------//
            //       scatterplot       //
            //-------------------------//

            // if scatterplot, create a dataframe and send it to plotDataFrame
            // multiply those two values for the ArraySize because plotFormula will create that many datapoints
            let df = new Array(this.dimensions.xVerticesCount * this.dimensions.zVerticesCount)

            // three values (x, y and z) that are going to be stored in the dataframe

            // line number in the new dataframe
            let i = 0
            let y = 0

            for(let x = 0; x < this.dimensions.xVerticesCount; x++)
            {
                for(let z = 0; z < this.dimensions.zVerticesCount; z++)
                {
                    y = this.MathParser.f(x/this.dimensions.xRes, z/this.dimensions.zRes) // calculate y. y = f(x1, x2)
                    df[i] = new Float32Array(3)
                    df[i][0] = x // store the datapoint
                    df[i][1] = y // store the datapoint
                    df[i][2] = z // store the datapoint
                    i++
                }
            }

            options.colorCol = 1 // y result of the evaluated formula

            // continue plotting this DataFrame
            this.plotDataFrame(df, 0, 1, 2, options)
        }
        else if(mode === "barchart")
        {

            //plotFormula
            //-------------------------//
            //        Bar Chart        //
            //-------------------------//


            // if barchart, create a dataframe and send it to plotDataFrame
            let df = new Array(this.dimensions.xVerticesCount * this.dimensions.zVerticesCount)

            // three values (x, y and z) that are going to be stored in the dataframe

            // line number in the new dataframe
            let i = 0
            let y = 0

            for(let x = 0; x <= this.dimensions.xVerticesCount; x++)
            {
                for(let z = 0; z <= this.dimensions.zVerticesCount; z++)
                {
                    y = this.MathParser.f(x/this.dimensions.xRes, z/this.dimensions.zRes) // calculate y. y = f(x1, x2)
                    df[i] = new Float32Array(3)
                    df[i][0] = x // store the datapoint
                    df[i][1] = y // store the datapoint
                    df[i][2] = z // store the datapoint
                    i++
                }
            }

            options.colorCol = 1 // y result of the evaluated formula

            // continue plotting this DataFrame
            this.plotDataFrame(df, 0, 1, 2, options)
        }
        else
        {

            if(mode != "polygon")
                console.warn("mode \""+mode+"\" unrecognized. Assuming \"polygon\"")

            //plotFormula
            //-------------------------//
            //         Polygon         //
            //-------------------------//

            // TODO:
            // https://stackoverflow.com/questions/12468906/three-js-updating-geometry-face-materialindex
            // This requires some more work. -inf and +inf values should be indicated by hidden faces around those vertices

            // creating the legend. As this polygon mode does not forward a dataframe to plotDataFrame, creating the legend has to be handled here in plotFormula
            let title = ""
            let x1title = "x1"
            let x2title = "x2"
            let x3title = "x3"
            if(options.title != undefined)  title = options.title
            if(options.x1title != undefined) x1title = options.x1title
            if(options.x2title != undefined) x2title = options.x2title
            if(options.x3title != undefined) x3title = options.x3title
            this.populateLegend({x1title, x2title, x3title, title})

            // same goes for colors. plotFormula has to handle them on it's own
            let hueOffset = 0
            if(this.checkNumber("hueOffset", options.hueOffset))
                hueOffset = parseFloat(options.hueOffset)
                
            /*let numberDensity = 2
            if(this.checkNumber("numberDensity", options.numberDensity))
                numberDensity = parseFloat(options.numberDensity)*/

            // might need to recreate the geometry and the matieral
            // is there a plotmesh already? Or maybe a plotmesh that is not created from a 3D Plane (could be a scatterplot or something else)
            // no need to check keepOldPlot because it is allowed to use the old mesh every time (if IsPlotmeshValid says it's valid)
            if(!this.IsPlotmeshValid("polygonFormula"))
            {
                // this.SceneHelper.disposeMesh(this.plotmesh)
                // create plane, divided into segments
                let planegeometry = new THREE.PlaneGeometry(this.dimensions.xLen, this.dimensions.zLen, this.dimensions.xVerticesCount, this.dimensions.zVerticesCount)
                // move it
                planegeometry.rotateX(Math.PI/2)
                planegeometry.translate(this.dimensions.xLen/2,0, this.dimensions.zLen/2)

                // color the plane
                let plotmat = [
                    new THREE.MeshBasicMaterial({
                        side: THREE.DoubleSide,
                        vertexColors: THREE.VertexColors
                    }),
                    new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0
                    })
                ]

                for(let i = 0;i < planegeometry.faces.length; i++)
                {
                    let faceColors = planegeometry.faces[i].vertexColors
                    faceColors[0] = new THREE.Color(0)
                    faceColors[1] = new THREE.Color(0)
                    faceColors[2] = new THREE.Color(0)
                }

                this.plotmesh = new THREE.Mesh(planegeometry, plotmat)
                this.plotmesh.name = "polygonFormula"
            }
            
            // if not, go ahead and manipulate the vertices

            // TODO hiding faces if typeof y is not number:
            // https://stackoverflow.com/questions/11025307/can-i-hide-faces-of-a-mesh-in-three-js

            // modifying vertex positions:
            // https://github.com/mrdoob/three.js/issues/972
            let y = 0
            let vIndex = 0

            // to counter the need for dividing each iteration
            let x1Actual = 0 // x
            let x3Actual = (this.dimensions.zVerticesCount-1)/this.dimensions.zRes // z
            let x1ActualStep = 1/this.dimensions.xRes
            let x3ActualStep = 1/this.dimensions.zRes
            let minX2 = 0
            let maxX2 = 0

            /*let faceIndex1 = 0
            let faceIndex2 = 0*/


            for(let z = this.dimensions.zVerticesCount; z >= 0; z--)
            {
                for(let x = 0; x <= this.dimensions.xVerticesCount; x++)
                {
                    y = this.MathParser.f(x1Actual, x3Actual)

                    /*// in each face there are 3 attributes, which stand for the vertex Indices (Which are vIndex basically)
                    // faces are ordered so that the vIndex in .c is in increasing order. If faceIndex.c has an unmatching value, increase
                    // the faceindex and therefore switch to a different face which mathes .c with vIndex.
                    while(faceIndex1 < this.plotmesh.geometry.faces.length && this.plotmesh.geometry.faces[faceIndex1].c < vIndex)
                    {
                        faceIndex1++
                    }
                    // the result of this operation is: faces[faceIndex].c === vIndex

                    // do similar for faceIndex2.
                    while(faceIndex2 < this.plotmesh.geometry.faces.length && this.plotmesh.geometry.faces[faceIndex2].a < vIndex)
                    {
                        faceIndex2++
                    }*/
                    
                    this.plotmesh.geometry.colors[vIndex] = new THREE.Color(0x6600ff)

                    if(!isNaN(y) && Math.abs(y) != Number.POSITIVE_INFINITY)
                    {
                        this.plotmesh.geometry.vertices[vIndex].y = y
                        
                        if(y > maxX2)
                            maxX2 = y
                        if(y < minX2)
                            minX2 = y
                    }
                    else
                    {
                        // console.warn("this does not fully work yet. Some vertex are at y = 0 but that face should be invisible")

                        // there are two faces per vertex that have VIndex as face.c
                        /*if(this.plotmesh.geometry.faces[faceIndex1+1] != undefined)
                        {
                            this.plotmesh.geometry.faces[faceIndex1].materialIndex = 1
                            this.plotmesh.geometry.faces[faceIndex1+1].materialIndex = 1
                            this.plotmesh.geometry.faces[faceIndex1+2].materialIndex = 1
                        }

                        //every second face has vIndex as face.a. 0 _ 1 _ 2 _ 3
                        if(this.plotmesh.geometry.faces[faceIndex2] != undefined)
                        {
                            this.plotmesh.geometry.faces[faceIndex2].materialIndex = 1
                        }*/
                        // https://stackoverflow.com/questions/12468906/three-js-updating-geometry-face-materialindex
                    }

                    vIndex ++
                    x1Actual += x1ActualStep
                }
                x1Actual = 0
                x3Actual -= x3ActualStep
            }

            
            // now colorate higher vertex get a warmer value
            // multiply min and max to lower the hue contrast and make it appear mor friendly
            let maxClrX2 = maxX2*1.3
            let minClrX2 = minX2*1.3
            let getVertexColor = (v) =>
            {
                let y = this.plotmesh.geometry.vertices[v].y
                return COLORLIB.convertToHeat(y,minClrX2,maxClrX2,hueOffset)
            }
            for(let i = 0;i < this.plotmesh.geometry.faces.length; i++)
            {
                let face = this.plotmesh.geometry.faces[i]
                face.vertexColors[0].set(getVertexColor(face.a))
                face.vertexColors[1].set(getVertexColor(face.b))
                face.vertexColors[2].set(getVertexColor(face.c))
            }

            if(normalizeX2)
            {
                let a = Math.max(Math.abs(maxX2), Math.abs(minX2)) // based on largest |value|
                let b = Math.abs(maxX2-minX2) // based on distance between min and max
                x2frac = Math.max(a, b) // hybrid
                this.plotmesh.geometry.scale(1,1/x2frac,1)
            }

        
            // if(this.SceneHelper.axes != undefined)
            //     this.SceneHelper.updateAxesNumbers(this.dimensions, {minX1: 0, maxX1: 1, minX2: 0, maxX2: 1, minX3: 0, maxX3: 1}, numberDensity)

            this.plotmesh.name = "polygonFormula"
            this.SceneHelper.scene.add(this.plotmesh)

            // normals need to be recomputed so that the lighting works after the transformation
            this.plotmesh.geometry.computeFaceNormals()
            this.plotmesh.geometry.computeVertexNormals()
            this.plotmesh.geometry.__dirtyNormals = true
            // make sure the updated mesh is actually rendered
            this.plotmesh.geometry.verticesNeedUpdate = true
            this.plotmesh.geometry.colorsNeedUpdate = true
            
            this.plotmesh.material.needsUpdate = true

            this.SceneHelper.makeSureItRenders(this.animationFunc)
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
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateOldData {boolean}: if false, don't overwrite the dataframe that is stored in the oldData-object
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */
    plotCsvString(sCsv, x1col, x2col, x3col, options = {})
    {
        //---------------------------//
        //  parameter type checking  //
        //---------------------------//

        // a more complete checking will be done in plotDataFrame once the dataframe is generated.
        // only check what is needed in plotCsvString
        
        if(sCsv === "" || !sCsv)
            return console.error("dataframe arrived empty")

        // default config
        let separator = ","
        let title = ""
        let fraction = 1
        let csvIsInGoodShape = false
        let header = true // assume header = true for now so that the parsing is not making false assumptions because it looks at headers

        // make sure options is defined
        if(typeof(options) !== {})
        {
            // seems like the user sent some parameters. check them

            // check variables. Overwrite if it's good. If not, default value will remain
            if(this.checkNumber("fraction", options.fraction)) fraction = parseFloat(options.fraction)
            if(this.checkBoolean("csvIsInGoodShape", options.csvIsInGoodShape)) csvIsInGoodShape = options.csvIsInGoodShape
            if(this.checkBoolean("header", options.header)) header = options.header

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

        //plotCsvString
        //-------------------------//
        //         caching         //
        //-------------------------//

        // still the same data?
        // create a very quick checksum sort of string
        let stepsize = (sCsv.length/20)|0
        let samples = ""
        for(let i = 0;i < sCsv.length; i+= stepsize)
            samples = samples + sCsv[i]

        // take everything into account that changes how the dataframe looks after the processing
        let checkstring = (title+sCsv.length+samples+fraction+separator).replace(/[\s\t\n\r]/g,"_")

        // now check if the checksum changed. If yes, remake the dataframe from the input
        if(this.oldData === null || this.oldData.checkstring != checkstring)
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

                if(data[0].indexOf(separator) === -1)
                    separator = /[\s\t]{2,}/g // tabbed data

                if(data[0].search(separator) === -1)
                    return console.error("no csv separator/delimiter was detected. Please set separator:\"...\" according to your file format: \""+data[0]+"\"")


                console.warn("the specified separator/delimiter was not found. Tried to detect it and came up with \""+separator+"\". Please set separator =\"...\" according to your file format: \""+data[0]+"\"")
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
                                if(data[line][col][data[line][col].length-1] === "\"")
                                    data[line][col] = data[line][col].slice(1,-1)

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

            // cache the dataframe. If the same dataframe is used next time, don't parse it again
            if(options.keepOldPlot != true)
                this.clearOldData()
            this.oldData.dataframe = data
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
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - updateOldData {boolean}: if false, don't overwrite the dataframe that is stored in the oldData-object
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */      
    plotDataFrame(df, x1col = 0, x2col = 1, x3col = 2, options ={})
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
        let header = false
        let colorCol =-1
        let mode = "scatterplot"
        let normalizeX1 = true
        let normalizeX2 = true
        let normalizeX3 = true
        let title = ""
        let fraction = 1 // TODO
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
        let x1frac = 1
        let x2frac = 1
        let x3frac = 1
        let numberDensity = 3

        // TODO probably deprecated won't implement
        // when true, the dataframe is a 2D Array an can be accessed like this: df[x][z] = y
        // it's experiemental and does not work yet for all plotting modes. It's there for performance increasing
        // because sometimes I am calculating a dataframe from a formula and then convert it to that [x][z] shape
        // instead of calculating this shape right away
        // let dfIsA2DMap = false


        // make sure options is defined
        if(typeof(options) === "object")
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

            if(this.checkNumber("fraction", options.fraction)) fraction = parseFloat(options.fraction)
            if(this.checkNumber("barchartPadding", options.barchartPadding)) barchartPadding = parseFloat(options.barchartPadding)
            if(this.checkNumber("hueOffset", options.hueOffset)) hueOffset = parseFloat(options.hueOffset)
            if(this.checkNumber("numberDensity", options.numberDensity)) numberDensity = parseFloat(options.numberDensity)
            if(this.checkNumber("x1frac", options.x1frac)) x1frac = parseFloat(options.x1frac)
            if(this.checkNumber("x2frac", options.x2frac)) x2frac = parseFloat(options.x2frac)
            if(this.checkNumber("x3frac", options.x3frac)) x3frac = parseFloat(options.x3frac)
            if(this.checkNumber("colorCol", options.colorCol)) colorCol = parseFloat(options.colorCol)
            if(this.checkNumber("dataPointSize", options.dataPointSize)) dataPointSize = parseFloat(options.dataPointSize)
            if(this.checkNumber("barSizeThreshold", options.barSizeThreshold)) barSizeThreshold = parseFloat(options.barSizeThreshold)
            
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

        }

        if(this.checkNumber("x1col", x1col)) x1col = parseFloat(x1col)
        else x1col = Math.min(0, df[0].length-1)
        if(this.checkNumber("x2col", x2col)) x2col = parseFloat(x2col)
        else x2col = Math.min(1, df[0].length-1)
        if(this.checkNumber("x3col", x3col)) x3col = parseFloat(x3col)
        else x3col = Math.min(2, df[0].length-1)
        
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


        if(fraction < 1)
        {
            // at least 3 rows if possible to support headers and two distinct datapoints
            df = df.slice(0, Math.max(Math.min(3,df.length),df.length*fraction))
        }


        // automatic header detection, if no option was provided and the dataframe has enough rows to support headers and data
        if(options.header === undefined && df.length >= 2)
        {
            // find out automatically if they are headers or not
            // take x1col, check first line type (string/NaN?) then second line type (number/!NaN?)
            // if both are yes, it's probably header = true
            if(isNaN(df[0][x1col]) && !isNaN(df[1][x1col]))
            {
                console.log("detected headers, first csv line is not going to be plotted therefore. To prevent this, set header = false")
                header = true
            }
        }
        
        let headerRow
        if(header)
        {
            if(df.length === 1)
                return console.error("dataframe is empty besides headers")

            headerRow = df[0]
            // still set to default values?
            if(x1title === "x1")
                x1title = headerRow[x1col]
            if(x2title === "x2")
                x2title = headerRow[x2col]
            if(x3title === "x3")
                x3title = headerRow[x3col]
            // remove the header from the dataframe. Usually you would just change the starting pointer for
            // the array. don't know if something like that exists in javascript
            df = df.slice(1, df.length)
        }

        // after all the modifying, is the dataframe still present?
        if(df.length === 0)
            return console.error("dataframe is empty")

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
        if(mode !== "barchart")
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
        // finds out by how much the values (as well as colors) to divide and for the colors also a displacement

        // what is happening here?
        // minX1, maxX2, etc. are being loaded from the oldData object. They initially have 0 values
        // so they are zero now
        // then the dataframe gets analyzed (if enabled) and the min and max values are updated

        // if it is disabled, the old values from the oldData object are not updated. this is the default case for addDataPoint.
        // that means new datapoint might be so far away from the initial plot that they cannot be seen anymore, because it gets scaled according to the old normalization information
        // if the values of that datapoint are so ridiculously large compared to the initial plot
        // what is the initial plot? that's the dataframe one plotted initially (for example using plotCsvString(...) before using addDataPoint

        // normalize, so that the farthest away point is still within the xLen yLen zLen frame
        // TODO logarithmic normalizing (what about the displayed numbers, how are they going to get logarithmic scaling? What about the helper lines)
 
        let lineToAssumeFirstMinMaxValues = 0
        if(df.length >= 2)
            // assume second line if possible, because headers might be accidentally still there (because of wrong configuration)
            lineToAssumeFirstMinMaxValues = 1

       
        // the default values are 0. after the normalization loops the case of
        // them still being 0 will be handled by assigning 1 to x1-x3frac
        let minX1, maxX1, minX2, maxX2, minX3, maxX3
        // don't use deprecated values
        if(!keepOldPlot)
        {
            this.oldData.normalization.minX1 = 0
            this.oldData.normalization.maxX1 = 0
            this.oldData.normalization.minX2 = 0
            this.oldData.normalization.maxX2 = 0
            this.oldData.normalization.minX3 = 0
            this.oldData.normalization.maxX3 = 0
        }
        minX1 = this.oldData.normalization.minX1
        maxX1 = this.oldData.normalization.maxX1
        minX2 = this.oldData.normalization.minX2
        maxX2 = this.oldData.normalization.maxX2
        minX3 = this.oldData.normalization.minX3
        maxX3 = this.oldData.normalization.maxX3

        // console.error({minX1,maxX1,minX2,maxX2,minX3,maxX3})
        
        // keep old plot and normalization has not been calculated yet?
        // if(keepOldPlot && this.oldData.normalization === {})
        if(normalizeX1)
        {
            // if default values are still in the variables, use the first entry in the dataframe
            if(maxX1 === 0 && minX1 === 0)
            {
                maxX1 = df[lineToAssumeFirstMinMaxValues][x1col]
                minX1 = df[lineToAssumeFirstMinMaxValues][x1col]
            }

            // determine min and max for normalisation
            for(let i = 0; i < df.length; i++)
            {
                if((df[i][x1col]) > maxX1)
                    maxX1 = df[i][x1col]
                if((df[i][x1col]) < minX1)
                    minX1 = df[i][x1col]
            }

            // take care of normalizing it together with the in oldData stored dataframe in case keepOldPlot is true
            if(keepOldPlot)
                for(let i = 0; i < this.oldData.dataframe.length; i++)
                {
                    let check = parseFloat(this.oldData.dataframe[i][x1col])
                    if(check > maxX1)
                        maxX1 = check
                    if(check < minX1)
                        minX1 = check
                }
        }

        if(mode !== "barchart") // barcharts need their own way of normalizing x2, because they are the sum of closeby datapoints (interpolation) (and also old datapoints, depending on keepOldPlot)
        {
            if(normalizeX2)
            {
                // if default values are still in the variables, use the first entry in the dataframe
                if(maxX2 === 0 && minX2 === 0)
                {
                    maxX2 = df[lineToAssumeFirstMinMaxValues][x2col]
                    minX2 = df[lineToAssumeFirstMinMaxValues][x2col]
                }

                // determine min and max for normalisation
                for(let i = 0; i < df.length; i++)
                {
                    if((df[i][x2col]) > maxX2)
                        maxX2 = df[i][x2col]
                    if((df[i][x2col]) < minX2)
                        minX2 = df[i][x2col]
                }

                // take care of normalizing it together with the in oldData stored dataframe in case keepOldPlot is true
                if(keepOldPlot)
                    for(let i = 0; i < this.oldData.dataframe.length; i++)
                    {
                        let check = parseFloat(this.oldData.dataframe[i][x2col])
                        if(check > maxX2)
                            maxX2 = check
                        if(check < minX2)
                            minX2 = check
                    }
            }
        }

        if(normalizeX3)
        {
            // if default values are still in the variables, use the first entry in the dataframe
            if(maxX3 === 0 && minX3 === 0)
            {
                maxX3 = df[lineToAssumeFirstMinMaxValues][x3col]
                minX3 = df[lineToAssumeFirstMinMaxValues][x3col]
            }

            // determine min and max for normalisation
            for(let i = 0; i < df.length; i++)
            {
                if((df[i][x3col]) > maxX3)
                    maxX3 = df[i][x3col]
                if((df[i][x3col]) < minX3)
                    minX3 = df[i][x3col]
            }
            
            // take care of normalizing it together with the in oldData stored dataframe in case keepOldPlot is true
            if(keepOldPlot)
                for(let i = 0; i < this.oldData.dataframe.length; i++)
                {
                    let check = parseFloat(this.oldData.dataframe[i][x3col])
                    if(check > maxX3)
                        maxX3 = check
                    if(check < minX3)
                        minX3 = check
                }
        }

        //x1frac = Math.max(Math.abs(maxX1), Math.abs(minX1)) // based on largest |value|
        x1frac = Math.abs(maxX1-minX1) // based on distance between min and max
        if(x1frac === 0)
            x1frac = 1 // all numbers are the same, therefore maxX1 equals minX1, therefore x1frac is 0. prevent divison by zero

        x2frac = Math.abs(maxX2-minX2)
        if(x2frac === 0)
            x2frac = 1

        x3frac = Math.abs(maxX3-minX3)
        if(x3frac === 0)
            x3frac = 1

        this.benchmarkStamp("normalized the data")

        let colors = {dfColors, hueOffset}
        let columns = {x1col, x2col, x3col}
        let normalization = {normalizeX1, normalizeX2, normalizeX3, x1frac, x2frac, x3frac, minX1, minX2, minX3, maxX1, maxX2, maxX3}
        let appearance = {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize}
        let dimensions = {xLen: this.dimensions.xLen, yLen: this.dimensions.yLen, zLen: this.dimensions.zLen}

        if(mode === "barchart")
        {

            // plotDataFrame
            //-------------------------//
            //        Bar Chart        //
            //-------------------------//

            barchart(this, df, colors, columns, normalization, appearance, this.SceneHelper.cameraMode)
            // those values got overwritten in barchart(...):
            minX2 = normalization.minX2
            maxX2 = normalization.maxX2
            x2frac = normalization.x2frac
                
            this.benchmarkStamp("made a barchart")
        }
        /*else if(mode === "polygon")
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


        }*/
        else if(mode === "lineplot")
        {

            // plotDataFrame
            //-------------------------//
            //        lineplot         //
            //-------------------------//
        
            lineplot(this, df, colors, columns, normalization, appearance, dimensions)

            this.benchmarkStamp("made a lineplot")
        }
        else
        {

            // plotDataFrame
            //-------------------------//
            //       scatterplot       //
            //-------------------------//
            // This is the default mode
            
            if(mode !== "scatterplot")
                console.warn("mode \""+mode+"\" unrecognized. Assuming \"scatterplot\"")
                
            scatterplot(this, df, colors, columns, normalization, appearance, dimensions)
                
            this.benchmarkStamp("made a scatterplot")
        }


        
        // plotDataFrame
        //-------------------------//
        //       Axes Numbers      //
        //-------------------------//

        // if the mode changed, recreate the numbers because the normalization might have changed
        if(this.oldData.options.mode !== mode)
        {
            this.SceneHelper.disposeAllAxesNumbers()
            this.axesNumbersNeedUpdate = true
        }

        if(this.SceneHelper.axes != undefined)
        {
            // remember that axes get disposed when the dimensions (xLen, yLen, zLen) are changing
            // so updateNumbersAlongAxis should get called (that means updatex_ should be true) when they don't exist or something

            let xLen = this.dimensions.xLen
            let yLen = this.dimensions.yLen
            let zLen = this.dimensions.zLen


            // decide about the visibility
            let updatex1 = this.axesNumbersNeedUpdate || normalizeX1 && this.oldData.normalization.maxX1 !== maxX1 && this.oldData.normalization.minX1 !== minX1
            let updatex2 = this.axesNumbersNeedUpdate || normalizeX2 && this.oldData.normalization.maxX2 !== maxX2 && this.oldData.normalization.minX2 !== minX2
            let updatex3 = this.axesNumbersNeedUpdate || normalizeX3 && this.oldData.normalization.maxX3 !== maxX3 && this.oldData.normalization.minX3 !== minX3

            this.axesNumbersNeedUpdate = false

            this.oldData.normalization = {}
            this.oldData.normalization.minX1 = minX1
            this.oldData.normalization.maxX1 = maxX1
            this.oldData.normalization.minX2 = minX2
            this.oldData.normalization.maxX2 = maxX2
            this.oldData.normalization.minX3 = minX3
            this.oldData.normalization.maxX3 = maxX3

            if(updatex1)
            {
                this.SceneHelper.updateNumbersAlongAxis(numberDensity, xLen, XAXIS, minX1, maxX1)
            }
            
            // because barcharts are not normalized in the way, that the highest bar is as high as yLen and that the lowest is flat (0) (like scatterplots)
            // they have negative bars. So they are normalized a little bit differently. So the axes have to be numbered in a slightly different way
            // minX2 is important for the positioning of the axis number. But in the case of barcharts, it needs to be 0, because the whole plot is not moved
            // to the top by minX1. axesNumbersNeedUpdateNumbers basically recreates the height of the highest bar/datapoint in the 3D space.
            if(updatex2)
            {
                let minX2_2 = minX2
                let yLen_2 = yLen
                if(mode === "barchart")
                {
                    minX2_2 = 0
                    yLen_2 = yLen * (maxX2-minX2_2)/x2frac
                }
                this.SceneHelper.updateNumbersAlongAxis(numberDensity, yLen_2, YAXIS, minX2_2, maxX2)
            }

            if(updatex3)
            {
                this.SceneHelper.updateNumbersAlongAxis(numberDensity, zLen, ZAXIS, minX3, maxX3)
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

        
        this.oldData.options.mode = mode

        // plotDataFrame
        //-------------------------//
        //         History         //
        //-------------------------//
        // used for addDataPoint to store what was plotted the last time
        // also used to store the material in some cases so that it does not have to be recreated each time

        // now that the script arrived here, store the options to make easy redraws possible
        // update cache

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

            this.oldData.options = options
        }

        this.SceneHelper.makeSureItRenders(this.animationFunc)
    }



    /**
     * repeats the drawing using the dataframe memorized in oldData, but adds a new datapoint to it
     * @param {any} newDatapoint Array that contains the attributes of the datapoints in terms of x1, x2, x3, x4, x5 etc.
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
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated
     * as if it was a color. (converted to hexadecimal then). Default false
     * - x1title {string}: title of the x1 axis
     * - x2title {string}: title of the x2 axis
     * - x3title {string}: title of the x3 axis
     * - hueOffset {number}: how much to rotate the hue of the labels. between 0 and 1. Default: 0
     * - keepOldPlot {boolean}: don't remove the old datapoints/bars/etc. when this is true
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */
    addDataPoint(newDatapoint, options ={})
    {            
        // overwrite old options
        for(let key in options)
            this.oldData.options[key] = options[key]

        // default keepOldPlot, but make it possible to overwrite it.
        this.oldData.options.keepOldPlot = true // true, so that the old plot gets extended with the new datapoint
        if(options.keepOldPlot != undefined)
            this.oldData.options.keepOldPlot = options.keepOldPlot

        // the following have to be like this:
        this.oldData.options.header = false // no header in newDataPoint
        this.oldData.options.updateOldData = false // false, because don't delete the original dataframe from cache
        this.oldData.options.maxX1

        // those default values are important to be like this.
        if(options.normalizeX1 === undefined)
            this.oldData.options.normalizeX1 = false
        if(options.normalizeX2 === undefined)
            this.oldData.options.normalizeX2 = false
        if(options.normalizeX3 === undefined)
            this.oldData.options.normalizeX3 = false
        // if(this.oldData.options.normalizeX1 || this.oldData.options.normalizeX2 || this.oldData.options.normalizeX3)
        //     console.warn("addDataPoint with turned on normalization options will not align the new datapoint with the old plots normalization.")

        // create the datapoint data structure (an array) from this
        if(typeof(newDatapoint) === "string")
        {
            newDatapoint = newDatapoint.split(this.oldData.separator)
            for(let i = 0;i < newDatapoint.length; i++)
                newDatapoint[i] = newDatapoint[i].trim()
        }

        // create a new dataframe from scratch if non existant
        this.oldData.dataframe[this.oldData.dataframe.length] = newDatapoint
        
        if(newDatapoint.length != this.oldData.dataframe[0].length)
            return console.error("the new datapoint does not match the number of column in the in oldData stored dataframe ("+newDatapoint.length+" != "+this.oldData.dataframe[0].length+")")

        // because of keepOldPlot, only hand the newDatapoint over to plotDataFrame
        this.plotDataFrame([newDatapoint],
            this.oldData.x1col,
            this.oldData.x2col,
            this.oldData.x3col,
            this.oldData.options // oldData.options got overwritten in this function
        )

        // destroy the in oldData stored string csv checkstring, indicate that the dataframe has been modified by addDataPoint
        // do this, because otherwise when plotting the same (initial) dataframe again it might not realize that the in oldData stored dataframe has
        // been extended by addDataPoint, so plotCsvString might use the in oldData stored (longer) dataframe than the one passed as parameter
        this.oldData.checkstring += "_addDP"

        // numbers might change
        if(options.normalizeX1 || options.normalizeX2 || options.normalizeX3)
        {
            this.axesNumbersNeedUpdate = true
        }

        return 0
    }



    /**
     * updates the legend with new information. basically recreates the innerHTML of this.legend.element
     * @param {object} colorMap COLORLIB.getColorMap(...) information. can be null
     * @param {object} options json object containing one or more of x1title, x2title, x3title and title
     */
    populateLegend(options)
    {
        // update the legend with the label color information
        // open legend, add title
        let legendHTML = ""
        if(options.title && options.title != "")
            legendHTML += "<h1>"+options.title+"</h1>"

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
        if(options.x1title)
            legendHTML += "<tr><td>x:</td><td>"+options.x1title+"</td></tr>"
        if(this.SceneHelper.cameraMode != TOPCAMERA && options.x2title)
            legendHTML += "<tr><td>y:</td><td>"+options.x2title+"</td></tr>"
        if(options.x3title)
            legendHTML += "<tr><td>z:</td><td>"+options.x3title+"</td></tr>"
        legendHTML += "</tbody></table>"

        // is the content similar? Then don't overwrite because it will trigger rerenders every time (observed in the chromium Elements view)
        if(this.legend.element.innerHTML.trim() != legendHTML) // for some reason I have to trim the current innerHTML
            this.legend.element.innerHTML = legendHTML
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
            return console.error("container for createLegend not found")
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
            this.updatePlotmesh = false
            return false
        }
            
        // it either has children because it's a group it has a geometry. if both are undefined, it's not valid anymore.

        if(this.updatePlotmesh === true) // this is the only place where this.updatePlotmesh is taken into account
        {
            this.SceneHelper.disposeMesh(obj)
            this.updatePlotmesh = false
            return false
        }


        if(obj.name === check)
            return true

        if(obj.type === check)
            return true

            
        this.SceneHelper.disposeMesh(obj)
        this.updatePlotmesh = false
        return false
    }



    /**
     * clears the oldData-object and initializes it
     * @private
     */
    clearOldData()
    {
        this.oldData = {}

        this.oldData.normalization = {
            minX1: 0,
            maxX1: 0,
            minX2: 0,
            maxX2: 0,
            minX3: 0,
            maxX3: 0,
        }

        this.oldData.labelColorMap = {}
        this.oldData.numberOfLabels = 0
        this.oldData.material = null
        this.oldData.dataframe = []
        this.oldData.x1col = 0
        this.oldData.x2col = 1
        this.oldData.x3col = 2
        this.oldData.checkstring = ""
        this.oldData.barsGrid = null
        
        this.oldData.options = {}
        this.oldData.options.mode = ""
    }



    /**
     * sets the container of this plot
     * TODO what happens when this function is used during runtime? Can the container be changed? What if the containers have different width and height?
     * @param {object} container DOM-Element of the new container
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
     * @param {object} dimensions json object can contain the following:
     * - xRes number of vertices for the x-axis
     * - zRes number of vertices for the z-axis
     * - xLen length of the x-axis. This is for the frame for data normalisation and formula plotting
     * - yLen length of the y-axis. This is for the frame for data normalisation and formula plotting
     * - zLen length of the z-axis. This is for the frame for data normalisation and formula plotting
     */
    setDimensions(dimensions)
    {
        if(typeof(dimensions) != "object")
            return console.error("param of setDimensions (dimensions) should be a json object containing at least one of xRes, zRes, xLen, yLen or zLen")

        if(dimensions.yLen == 0)
        {
            dimensions.yLen = 0.001 // 0 will cause trouble because determinants become zero
            this.SceneHelper.changeCameraMode(TOPCAMERA) // uses an orthographic camera
        }
        else
        {
            this.SceneHelper.changeCameraMode(DEFAULTCAMERA)
        }

        if(dimensions.xRes != undefined)
            this.dimensions.xRes = Math.max(1, Math.abs(dimensions.xRes|0))
        if(dimensions.zRes != undefined)
            this.dimensions.zRes = Math.max(1, Math.abs(dimensions.zRes|0))
        if(dimensions.xLen != undefined)
            this.dimensions.xLen = Math.abs(dimensions.xLen)
        if(dimensions.yLen != undefined)
            this.dimensions.yLen = Math.abs(dimensions.yLen)
        if(dimensions.zLen != undefined)
            this.dimensions.zLen = Math.abs(dimensions.zLen)

        if(dimensions.xVerticesCount != undefined || dimensions.zVerticesCount != undefined)
            console.warn("xVerticesCount and zVerticesCount cannot be manually overwritten. They are the product of Length and Resolution.",
                "Example: setDimensions({xRes:10, xLen:2}) xVerticesCount now has a value of 20")

        // no need to check here if specific parameters were defined in dimensions, because this accesses
        // this.dimensions which contains those values, that were not defined here as parameter
        this.dimensions.xVerticesCount = Math.max(1, Math.round(this.dimensions.xLen*this.dimensions.xRes))
        this.dimensions.zVerticesCount = Math.max(1, Math.round(this.dimensions.zLen*this.dimensions.zRes))
    

        // move
        this.SceneHelper.centerCamera(this.dimensions)
        this.SceneHelper.updateAxesSize(this.dimensions,this.oldData.normalization)

        // vertices counts changed, so the mesh has to be recreated
        this.updatePlotmesh = true
        // axes have to be updates aswellc

        // takes effect once the mesh gets created from new, except for the lengths indicated by the axes. those update immediatelly
        //this.SceneHelper.render()
    }






    /*-- Animations --*/

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
        this.SceneHelper.onChangeCamera = function() {}
        this.animationFunc = animationFunc
        this.callAnimation()
    }

    /**
     * stops the ongoing animation. To start an animation, see animate(...)
     */
    stopAnimation()
    {
        this.animationFunc = null
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
            return

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
     * Creates new axes with the defined color and triggers a rerender
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
