const THREE = require("three")
// thanks to the "default" property they can be imported like this:
import JsP3D_MathParser from "./JsP3D_MathParser.js"
import JsP3D_SceneHelper from "./JsP3D_SceneHelper.js"
export const COLORLIB = require("./JsP3D_ColorLib.js") // make it available as JSPLOT3D.COLORLIB


/**
 * Plots Dataframes and Formulas into a 3D Space
 * @module JsPlot3D
 */
export class Plot
{

    /**
     * Creates a Plot instance, so that a single canvas can be rendered. After calling this constructor, rendering can
     * be done using plotFormula(s), plotCsvString(s) or plotDataFrame(df)
     * @param {object} container     html div DOM element which can then be selected using document.getElementById("foobar") with foobar being the html id of the container
     * @param {json}   sceneOptions  optional. at least one of backgroundColor or axesColor in a Json Format {}. Colors can be hex values "#123abc" or 0x123abc, rgb and hsl (e.g. "rgb(0.3,0.7,0.1)")
     */
    constructor(container, sceneOptions={})
    {
        // parameter checking
        if(typeof(container) != "object")
            return console.error("second param for the Plot constructor (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")

        // The order of the following tasks is important!

        // initialize cache object
        this.resetCache()

        // scene helper is needed for setContainer
        this.SceneHelper = new JsP3D_SceneHelper()

        // first set up the container and the dimensions
        this.setContainer(container)
        this.dimensions = {}
        this.setDimensions({xRes:20, zRes:20, xLen:1, yLen:1, zLen:1})
        
        // before MathParser, setDimensions has to be called to initialize some stuff (xVerticesCount and zVerticesCount)
        this.MathParser = new JsP3D_MathParser(this)

        // then setup the children of the scene (camera, light, axes)
        this.SceneHelper.createScene(this.dimensions, sceneOptions, {width: container.offsetWidth, height: container.offsetHeight})
        this.SceneHelper.centerCamera(this.dimensions)

        // legend
        this.initializeLegend()

        // by default disable the benchmark process
        this.benchmark = {}
        this.benchmark.enabled = false

        this.SceneHelper.render()
    }


    // some helper functions
    errorParamType(varname, variable, expectedType)
    {
        console.error("expected '"+expectedType+"' but found '"+typeof(variable)+"' for "+varname+" ("+variable+")")
    }
    
    checkBoolean(varname, variable)
    {
        if(variable === undefined)
            return // not defined in the (optional) options, don't do anything then
        let a = (variable === true || variable === false)
        if(!a) this.errorParamType(varname, variable, "boolean")
        return(a) // returns true (valid) or false
    }

    checkNumber(varname, variable)
    {
        if(variable === undefined || variable === "")
            return // not defined in the (optional) options, don't do anything then
        if(typeof(variable) != "number" && isNaN(parseFloat(variable)))
            return this.errorParamType(varname, variable, "number")
        else return true // returns true (valid) or false
    }

    /**
     * plots a formula into the container as 3D Plot
     * @param {string}  originalFormula string of formula
     * @param {object} options
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
     * - updateCache {boolean}: if false, don't overwrite the dataframe that is stored in the cache
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0  
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
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

        if(originalFormula === undefined || originalFormula === "")
            return console.error("first param of plotFormula (originalFormula) is undefined or empty")
        if(typeof(originalFormula) != "string")
            return console.error("first param of plotFormula (originalFormula) should be string")

        this.MathParser.resetCalculation()
        this.MathParser.parse(originalFormula) //tell the MathParser to prepare so that f can be executed
        this.dfCache.checkstring = "" // don't fool plotCsvString into believing the cache contains still old csv data

        if(mode === "scatterplot")
        {
            
            //PlotFormula
            ////////  SCATTERPLOT    ////////

            // if scatterplot, create a dataframe and send it to plotDataFrame
            // multiply those two values for the ArraySize because plotFormula will create that many datapoints
            let df = new Array(this.dimensions.xVerticesCount * this.dimensions.zVerticesCount)

            // the three values that are going to be stored in the dataframe
            let y = 0
            let x = 0
            let z = 0

            // line number in the new dataframe
            let i = 0

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

            //PlotFormula
            ////////  BARCHART ////////


            // if barchart, create a dataframe and send it to plotDataFrame
            let df = new Array(this.dimensions.xVerticesCount * this.dimensions.zVerticesCount)

            // the three values that are going to be stored in the dataframe
            let y = 0
            let x = 0
            let z = 0

            // line number in the new dataframe
            let i = 0

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

            if(mode != "polygon" && mode != undefined)
                console.warn("mode \""+mode+"\" unrecognized. Assuming \"polygon\"")

            ////////  POLYGON ////////

            // TODO:
            // https://stackoverflow.com/questions/12468906/three-js-updating-geometry-face-materialindex
            // color heatmap like

            // creating the legend. As this polygon mode does not forward a dataframe to plotDataFrame, creating the legend has to be handled here in plotFormula
            let title=""
            let x1title="x1"
            let x2title="x2"
            let x3title="x3"
            if(options.title != undefined)
                title = options.title
            if(options.x1title != undefined)
                x1title = options.x1title
            if(options.x2title != undefined)
                x2title = options.x2title
            if(options.x3title != undefined)
                x3title = options.x3title
            this.populateLegend({x1title, x2title, x3title, title})

            // same goes for colors. plotFormula has to handle them on it's own
            let hueOffset=0
            if(this.checkNumber("hueOffset", options.hueOffset))
                hueOffset = parseFloat(options.hueOffset)
                
            let numberDensity=2
            if(this.checkNumber("numberDensity", options.numberDensity))
                numberDensity = parseFloat(options.numberDensity)

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
                    ];

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

            let faceIndex1 = 0
            let faceIndex2 = 0


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
                        // console.warn("this does not fully work yet. Some vertex are at y=0 but that face should be invisible")

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
            let getVertexColor = (v,index) =>
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

        
            if(this.SceneHelper.axes != undefined)
                this.SceneHelper.updateAxesNumbers(this.dimensions, {minX1: 0, maxX1: 1, minX2: 0, maxX2: 1, minX3: 0, maxX3: 1}, numberDensity)

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
     * - updateCache {boolean}: if false, don't overwrite the dataframe that is stored in the cache
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
        
        if(sCsv === "" || sCsv === undefined)
            return console.error("dataframe arrived empty")

        // default config
        let separator=","
        let title=""
        let fraction=1
        let csvIsInGoodShape=false
        let header=true // assume header=true for now so that the parsing is not making false assumptions because it looks at headers

        // make sure options is defined
        if(typeof(options) === "object")
        {
            // seems like the user sent some parameters. check them

            // treat empty strings as if it was undefined in those cases:
            if(options.separator === "")
                options.separator = undefined

            // check numbers. Overwrite if it's good. If not, default value will remain
            if(this.checkNumber("fraction", options.fraction))
                fraction = parseFloat(options.fraction)

            // check booleans
            if(this.checkBoolean("csvIsInGoodShape", options.csvIsInGoodShape))
                csvIsInGoodShape = options.csvIsInGoodShape
            if(this.checkBoolean("header", options.header))
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
        let stepsize = (sCsv.length/20)|0
        let samples = ""
        for(let i = 0;i < sCsv.length; i+=stepsize)
            samples = samples + sCsv[i]

        // take everything into account that changes how the dataframe looks after the processing
        let checkstring = title+sCsv.length+samples+fraction+separator

        // now check if the checksum changed. If yes, remake the dataframe from the input
        if(this.dfCache === undefined || this.dfCache.checkstring != checkstring)
        {
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
                let minimumLineCount = 2 // 2 because 2 datapoints need to be there to form a plot. Otherwise a single datapoint would just jump to 1, 1, 1 because of normalization
                if(header)
                    minimumLineCount ++
                    
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


                console.warn("the specified separator/delimiter was not found. Tried to detect it and came up with \""+separator+"\". Please set separator=\"...\" according to your file format: \""+data[0]+"\"")
            }

            if(!csvIsInGoodShape)
            {
                // check 5% of the columns to get the highest number of columns available
                let columnCount = 0
                for(let i = 0;i < Math.min(data.length, data.length*0.05+10);i++)
                {
                    columnCount = Math.max(columnCount, data[i].split(separator).length)
                }

                for(let i = 0;i < data.length; i ++)
                {
                    data[i] = data[i].trim().split(separator)
                    
                    // make sure every row has the same number of columns
                    data[i] = data[i].slice(0, columnCount)
                    data[i] = data[i].concat(new Array(columnCount-data[i].length))

                    // remove leading and ending whitespaces in data
                    for(let j = 0;j < data[i].length; j++)
                    {

                        // make sure every column has stored a value. if not (maybe because of faulty csv formats), assume 0
                        if(data[i][j] === undefined)
                        {
                            data[i][j] = 0
                        }
                        else
                        {
                            // remove quotation marks "bla";"1";"2"
                            if(data[i][j][0] === "\"")
                                if(data[i][j][data[i][j].length-1] === "\"")
                                    data[i][j] = data[i][j].slice(1,-1)

                                // don't assume that all lines have the same format when looking at the same column
                                // that means every cell has to be parsed
                                
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
                // that means: no quotation marks and all rows have the same number of columns
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
                        for(let line = 0;line < data.length; line ++) // continue like so for all following datapoints/rows without further checking
                            data[line][col] = parseFloat(data[line][col])
                }
            }

            // cache the dataframe. If the same dataframe is used next time, don't parse it again
            if(options.keepOldPlot != true)
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
     * - updateCache {boolean}: if false, don't overwrite the dataframe that is stored in the cache
     * - barSizeThreshold {number}: smallest allowed y value for the bars. Smaller than that will be hidden. Between 0 and 1. 1 Hides all bars, 0 shows all. Default 0
     * - numberDensity {number}: how many numbers to display when the length (xLen, yLen or zLen) equals 1. A smaller axis displays fewer numbers and a larger axis displays more.
     */
                
    plotDataFrame(df, x1col=0, x2col=1, x3col=2, options={}, normalization={})
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
        let dataPointSize=0.04
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
        let numberDensity=2
        // let normalizationSmoothing=0

        if(this.dfCache === undefined)
            this.resetCache()

        // when true, the dataframe is a 2D Array an can be accessed like this: df[x][z] = y
        // it's experiemental and does not work yet for all plotting modes. It's there for performance increasing
        // because sometimes I am calculating a dataframe from a formula and then convert it to that [x][z] shape
        // instead of calculating this shape right away
        let dfIsA2DMap=false


        // make sure options is defined
        if(typeof(options) === "object")
        {
            // seems like the user sent some parameters. check them

            // treat empty strings as if it was undefined in those cases:
            if(options.colorCol === "")
                options.colorCol = undefined

            // check numbers. Overwrite if it's good. If not, default value will remain
            if(options.colorCol != undefined && options.colorCol >= df[0].length)
            {
                console.error("column with index "+options.colorCol+", used as colorCol, is not existant in the dataframe. Disabling coloration")
                options.colorCol = -1
            }
            if(this.checkNumber("fraction", options.fraction))
                fraction = parseFloat(options.fraction)
            if(this.checkNumber("barchartPadding", options.barchartPadding))
                barchartPadding = parseFloat(options.barchartPadding)
            if(barchartPadding >= 1)
            {
                barchartPadding = 0
                console.error("barchartPadding is invalid. maximum of 1 and minimum of 0 accepted. Now continuing with barchartPadding = "+barchartPadding)
            }

            if(this.checkNumber("hueOffset", options.hueOffset))
                hueOffset = parseFloat(options.hueOffset)
            if(this.checkNumber("numberDensity", options.numberDensity))
                numberDensity = parseFloat(options.numberDensity)
            if(this.checkNumber("x1frac", options.x1frac))
                x1frac = parseFloat(options.x1frac)
            if(this.checkNumber("x2frac", options.x2frac))
                x2frac = parseFloat(options.x2frac)
            if(this.checkNumber("x3frac", options.x3frac))
                x3frac = parseFloat(options.x3frac)
            if(this.checkNumber("colorCol", options.colorCol))
                colorCol = parseFloat(options.colorCol)
            if(this.checkNumber("dataPointSize", options.dataPointSize))
                dataPointSize = parseFloat(options.dataPointSize)
            if(this.checkNumber("barSizeThreshold", options.barSizeThreshold))
                barSizeThreshold = parseFloat(options.barSizeThreshold)
            // if(this.checkNumber("normalizationSmoothing", options.normalizationSmoothing))
            //    normalizationSmoothing = parseFloat(options.normalizationSmoothing)
            if(dataPointSize <= 0)
                console.error("datapoint size is <= 0. It will be invisible")

            // check booleans. Overwrite if it's good. If not, default value will remain
            if(this.checkBoolean("labeled", options.labeled))
                labeled = options.labeled
            if(this.checkBoolean("normalizeX1", options.normalizeX1))
                normalizeX1 = options.normalizeX1
            if(this.checkBoolean("normalizeX2", options.normalizeX2))
                normalizeX2 = options.normalizeX2
            if(this.checkBoolean("normalizeX3", options.normalizeX3))
                normalizeX3 = options.normalizeX3
            if(this.checkBoolean("header", options.header))
                header = options.header
            if(this.checkBoolean("dfIsA2DMap", options.dfIsA2DMap))
                dfIsA2DMap = options.dfIsA2DMap
            if(this.checkBoolean("filterColor", options.filterColor))
                filterColor = options.filterColor
            if(this.checkBoolean("keepOldPlot", options.keepOldPlot))
                keepOldPlot = options.keepOldPlot
            if(this.checkBoolean("updateCache", options.updateCache))
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

        if(this.checkNumber("x1col", x1col))
            x1col = parseFloat(x1col)
        else x1col = Math.min(0, df[0].length-1)
        if(this.checkNumber("x2col", x2col))
            x2col = parseFloat(x2col)
        else x2col = Math.min(1, df[0].length-1)
        if(this.checkNumber("x3col", x3col))
            x3col = parseFloat(x3col)
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
            // at least 2 rows
            df = df.slice(0, Math.max(Math.min(2,df.length),df.length*fraction))
        }


        // automatic header detection
        if(options.header === undefined && df.length >= 2)
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
        let colorMap, dfColors
        if(mode != "barchart")
        {
            colorMap = COLORLIB.getColorMap(df, colorCol, defaultColor, labeled, header, filterColor, hueOffset)
            if(colorMap === -1)
            {
                // COLORLIB requests to restart "getColorMap" using labeled = true
                labeled = true
                options.labeled = labeled
                colorMap = COLORLIB.getColorMap(df, colorCol, defaultColor, labeled, header, filterColor, hueOffset)
            }
            dfColors = colorMap.dfColors
        }

        // display information about the labels
        this.populateLegend({colorMap, x1title, x2title, x3title, title})

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

        
        let minX2 = 0
        let maxX2 = 1
        let minX1 = 0
        let maxX1 = 1
        let minX3 = 0
        let maxX3 = 1
        
        //keep old plot and normalization has not been calculated yet?
        //if(keepOldPlot && this.dfCache.normalization === {})
        if(normalizeX1)
        {
            maxX1 = df[startValueIndex][x1col]
            minX1 = df[startValueIndex][x1col]
            // determine max for normalisation
            for(let i = 0; i < df.length; i++)
            {
                if((df[i][x1col]) > maxX1)
                    maxX1 = df[i][x1col]
                if((df[i][x1col]) < minX1)
                    minX1 = df[i][x1col]
            }

            // take care of normalizing it together with the cached dataframe in case keepOldPlot is true
            if(keepOldPlot)
                for(let i = 0; i < this.dfCache.dataframe.length; i++)
                {
                    if(parseFloat(this.dfCache.dataframe[i][x1col]) > maxX1)
                        maxX1 = this.dfCache.dataframe[i][x1col]
                    if(parseFloat(this.dfCache.dataframe[i][x1col]) < minX1)
                        minX1 = this.dfCache.dataframe[i][x1col]
                }
                
            //x1frac = Math.max(Math.abs(maxX1), Math.abs(minX1)) // based on largest |value|
            x1frac = Math.abs(maxX1-minX1) // based on distance between min and max
            
            if(x1frac === 0)
                x1frac = 1 // all numbers are the same, therefore maxX1 equals minX1, therefore x1frac is 0. prevent divison by zero
        }

        if(mode != "barchart") // barcharts need their own way of normalizing x2, because they are the sum of closeby datapoints (interpolation) (and also old datapoints, depending on keepOldPlot)
        {
            if(normalizeX2)
            {
                maxX2 = df[startValueIndex][x2col]
                minX2 = df[startValueIndex][x2col]
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
                        if(parseFloat(this.dfCache.dataframe[i][x2col]) > maxX2)
                            maxX2 = this.dfCache.dataframe[i][x2col]
                        if(parseFloat(this.dfCache.dataframe[i][x2col]) < minX2)
                            minX2 = this.dfCache.dataframe[i][x2col]
                    }
                // a hybrid solution of checking the distance between the points and checking the |value|
                //let a = Math.max(Math.abs(maxX2), Math.abs(minX2)) // based on largest |value|
                //let b = Math.abs(maxX2-minX2) // based on distance between min and max
                //x2frac = Math.max(a, b) // hybrid

                x2frac = Math.abs(maxX2-minX2) // based on distance between min and max

                if(x2frac === 0)
                    x2frac = 1 // all numbers are the same, therefore maxX2 equals minX2, therefore x2frac is 0. prevent divison by zero
            }
        }

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
                
            //x3frac = Math.max(Math.abs(maxX3), Math.abs(minX3)) // based on largest |value|
            x3frac = Math.abs(maxX3-minX3) // based on distance between min and max
            
            if(x3frac === 0)
                x3frac = 1 // all numbers are the same, therefore maxX3 equals minX3, therefore x3frac is 0. prevent divison by zero
        }

        this.benchmarkStamp("normalized the data")

        
        if(mode === "barchart")
        {

            // plotDataFrame
            //-------------------------//
            //        Bar Chart        //
            //-------------------------//



            // this.dfCache.previousX2frac = 1 // for normalizationSmoothing. Assume that the data does not need to be normalized at first
            // let xBarOffset = 1/this.dimensions.xRes/2
            // let zBarOffset = 1/this.dimensions.zRes/2



            // if normalization is on, make sure that the bars at x=0 or z=0 don't intersect the axes
            let xOffset = 0
            let zOffset = 0
            // because of the offset, render the bars closer to each other so that they
            // don't exceed the space defined by the gridHelper
            let xfracIncrease = 0
            let zfracIncrease = 0
            if(normalizeX1)
            {
                xOffset = 1/this.dimensions.xRes/2 //divide by two because to counter the intersection only half of the bar has to be moved away
                xfracIncrease = 1
            }
            if(normalizeX3)
            {
                zOffset = 1/this.dimensions.zRes/2
                zfracIncrease = 1
            }

            // helper function
            let createBar = (x, z, cubegroup) =>
            {
                // create the bar
                // I can't put 0 into the height parameter of the CubeGeometry constructor because if I do it will not construct as a cube
                let shape = new THREE.CubeGeometry((1-barchartPadding)/(this.dimensions.xRes+xfracIncrease),1,(1-barchartPadding)/(this.dimensions.zRes+zfracIncrease))

                // use translate when the position property should not be influenced
                // shape.translate(xBarOffset,0, zBarOffset)

                let plotmat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: 0,
                    emissiveIntensity: 0.98,
                    roughness: 1,
                    visible: false,
                    side: THREE.DoubleSide
                })

                let bar = new THREE.Mesh(shape, plotmat)
                bar.position.set(x/(this.dimensions.xRes+xfracIncrease)+xOffset,0, z/(this.dimensions.zRes+zfracIncrease)+zOffset)
                bar.geometry.translate(0,0.5,0)
                cubegroup.add(bar)

                return bar
            }


            // if needed, reconstruct the complete barchart
            let valid = this.IsPlotmeshValid("barchart")
            // shape of bars changed? recreate from scratch
            // let paddingValid = (options.barchartPadding === undefined && this.dfCache.options.barchartPadding === undefined) || (barchartPadding === this.dfCache.options.barchartPadding)

            if(!valid || !keepOldPlot)
            {
                this.SceneHelper.disposeMesh(this.plotmesh)
                this.resetCache()
                
                // into this group fill the bars
                let cubegroup = new THREE.Group()
                cubegroup.name = "barchart"

                this.plotmesh = cubegroup
                this.SceneHelper.scene.add(cubegroup)
            }

            // load what is stored
            let barsGrid = this.dfCache.barsGrid

            // if undefined, start creating a new barsGrid
            if(barsGrid === undefined)
            {
                barsGrid = {}
                this.dfCache.barsGrid = barsGrid
            }


            // dispose, reset if not needed anymore
            if(!keepOldPlot)
            {
                for(let keyx in barsGrid)
                    for(let keyz in barsGrid)
                        this.SceneHelper.disposeMesh(barsGrid[keyx][keyz].bar)

                barsGrid = {}
                this.dfCache.barsGrid = barsGrid
            }
            

            // fill the barsGrid array with the added heights of the bars
            // get a point from the dataframe. Calculate the coordinates from that.
            // to do this, the value has to be brought down to the normalized value (/x1frac). It now has maximum values of [-1, +1].
            // multiply by xVerticesCount, to get maximum values of [-xVerticesCount, +xVerticesCount]. Now apply the offset of +xVerticesCount to transform it to
            //[0, 2*xVerticesCount]
            // afterwards get that to an array index. remember, that the array has some parts reserved for negative x and z values by using an offset
            // so, divide x_float by x1frac and multiply it by xVerticesCount.
            // x_float = df[i][x1col]/x1frac*xVerticesCount = df[i][x1col]/(x1frac/xVerticesCount) = df[i][x1col]*(xVerticesCount/x1frac) = df[i][x1col]*xVerticesCount/x1frac
            let factorX1 = (this.dimensions.xVerticesCount)/x1frac
            let factorX3 = (this.dimensions.zVerticesCount)/x3frac

            // use the maximums from the recent run if keepOldPlot
            maxX2 = this.dfCache.normalization.maxX2
            minX2 = this.dfCache.normalization.minX2
            if(minX2 === undefined || maxX2 === undefined || !keepOldPlot)
            {
                // bars all start at y = 0 and grow towards -inf and +inf, so 0 is safe to assume
                maxX2 = 0
                minX2 = 0
            }


            // helper function for interpolation
            let addToHeights = (x, y, z, x_float, z_float) =>
            {
                /*
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

                if(oppositeSquareArea === 0)
                    return

                // create x and z indices if needed
                if(barsGrid[x] === undefined)
                {
                    barsGrid[x] = {}
                }
                if(barsGrid[x][z] === undefined)
                {
                    barsGrid[x][z] = {} // holds the bar object and y for this x, z position
                    barsGrid[x][z].y = 0
                }

                // update the heights
                barsGrid[x][z].y += y*oppositeSquareArea // initialized with 0, now +=
                // +=, because otherwise it won't interpolate. It has to add the value to the existing value

                // find the highest bar
                // even in case of normalizeX2 being false, do this, so that the heatmapcolor can be created
                if(barsGrid[x][z].y > maxX2)
                    maxX2 = barsGrid[x][z].y
                if(barsGrid[x][z].y < minX2)
                    minX2 = barsGrid[x][z].y

                // if needed create the bar
                if(barsGrid[x][z].bar === undefined)
                {
                    barsGrid[x][z].bar = createBar(x, z, this.plotmesh)
                }
                
                /*console.error(x, z,"is not defined in", barsGrid,
                    "this is a bug. This might happen because the code tries to interpolate beyond the "+
                    "bounds of the grid, but this normally should not be the case."
                )*/

                return
            } // end function declaration of addToHeights

            // don't get fooled and write code here and suspect it to run after the
            // normalization. Write it below the loop that calls addToHeights. Code below this comment
            // is for preparation of the normalization

            for(let i = 0; i < df.length; i ++)
            {

                // INTERPOLATE

                // get coordinates that can fit into an array
                // interpolate. When x and z is at (in case of parseFloat) e.g. 2.5,1. Add one half to 2,1 and the other hald to 3,1 
                
                // DEPRECATED: add the following, because the array is twice as large and the center is supposed to be at [xVertCount][zVertCount]
                // let x_float = df[i][x1col]*factorX1 + this.dimensions.xVerticesCount+1
                // let z_float = df[i][x3col]*factorX3 + this.dimensions.zVerticesCount+1

                // when normalizing, the data gets moved from the negative space to the positive space that the axes define
                // Data will then touch the x1x3, x1x2 and x3x2 planes instead of being somewhere far off at negative spaces
                // does this description make sense? i hope so.
                let x_float = (df[i][x1col]-minX1)*factorX1
                let z_float = (df[i][x3col]-minX3)*factorX3
                
                let x_le = Math.floor(x_float) // left
                let z_ba = Math.floor(z_float) // back

                let y = (df[i][x2col]) // don't normalize yet

                //handle invalid datapoints
                if(isNaN(y))
                {
                    console.warn("the dataframe contained a non-number value at", i, x2col,"called \"", y,"\". skipping that datapoint now")
                    continue //skip
                }

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

            // percent of largest bar
            barSizeThreshold = barSizeThreshold*Math.max(Math.abs(maxX2), Math.abs(minX2))

            if(normalizeX2 === true)
            {
                // let a = Math.max(Math.abs(maxX2), Math.abs(minX2)) // based on largest |value|
                // let b = Math.abs(maxX2-minX2) // based on distance between min and max
                // x2frac = Math.max(a, b) // hybrid

                x2frac = Math.abs(maxX2-minX2) // based on distance between min and max

                // a lower value of normalizationSmoothing will result in faster jumping around plots. 0 Means no smoothing this happens, because 
                // sometimes the plot might be close to 0 everywhere. This is not visible because of the normalization though one the sign
                // changes, it will immediatelly jump to be normalized with a different sign. To prevent this one can smoothen the variable x2frac
                // x2frac = (x2frac + normalizationSmoothing*this.dfCache.previousX2frac)/(normalizationSmoothing+1)
                // this.dfCache.previousX2frac = x2frac
                // this is a little bit too experimental at the moment. Once everything runs properly stable it's worth thinking about it
            }

            // now color the children & normalize
            for(let x in barsGrid)
            {
                for(let z in barsGrid[x])
                {
                    let bar = barsGrid[x][z].bar
                    if(bar != undefined)
                    {
                        let y = barsGrid[x][z].y
                        
                        let color = COLORLIB.convertToHeat(y, minX2, maxX2, hueOffset)
                        //bar.material.color.set(color) // .color property should stay the way it is defined (0xffffff), it's important for proper lighting
                        bar.material.emissive.set(color)

                        // hide that bar if it's smaller than or equal to the threshold
                        // y is now normalized (|y| is never larger than 1), so barSizeThreshold acts like a percentage value
                        if(Math.abs(y) > barSizeThreshold)
                        {
                            // make it visible if it's not zero
                            bar.material.visible = true
                        }
                        else
                        {
                            bar.material.visible = false
                        }

                        y = y/x2frac*this.dimensions.yLen
                        
                        // those are the vertex of the barchart that surround the top face
                        // no need to recompute normals, because they still face in the same direction
                        bar.geometry.vertices[0].y = y
                        bar.geometry.vertices[1].y = y
                        bar.geometry.vertices[4].y = y
                        bar.geometry.vertices[5].y = y
                        // make sure the updated vertex actually display
                        bar.geometry.verticesNeedUpdate = true
                    }
                }
            }

            this.benchmarkStamp("made a bar chart")
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

            // iterate over dataframe datapoints, connect the latest point with the new one
            //  +---+---+---+--> +   +   +
            // it goes zig zag through the 3D Space

            // Based on scatterplot
        
            let wireframeLinewidth = dataPointSize*100

            let isItValid = this.IsPlotmeshValid("lineplot")
            let isOldMaterialSimilar = (this.dfCache != undefined && this.dfCache.material != undefined && wireframeLinewidth === this.dfCache.material.wireframeLinewidth)

            if(!keepOldPlot || !isItValid || !isOldMaterialSimilar)
            {
                this.SceneHelper.disposeMesh(this.plotmesh)

                let material = new THREE.LineBasicMaterial({
                    vertexColors: THREE.VertexColors,
                    linewidth: wireframeLinewidth,
                    linecap: "round",
                    linejoin: "round"
                    })

                this.dfCache.material = material
                this.plotmesh = new THREE.Group()
                this.plotmesh.name = "lineplot"
                this.SceneHelper.scene.add(this.plotmesh)
            }

            let material = this.dfCache.material
            let group = this.plotmesh
            let geometry = new THREE.Geometry()
            
            for(let i = 0; i < df.length; i ++)
            {
                let vertex = new THREE.Vector3()
                vertex.x = (df[i][x1col]-minX1)/x1frac*this.dimensions.xLen
                vertex.y = (df[i][x2col]-minX2)/x2frac*this.dimensions.yLen
                vertex.z = (df[i][x3col]-minX3)/x3frac*this.dimensions.zLen

                // three.js handles invalid vertex already by skipping them
                geometry.vertices.push(vertex)
                /*if(i > 1)
                {
                    let newFace = new THREE.Face3(i-1, i-1, i)
                    newFace.vertexColors[0] = dfColors[i-1]
                    newFace.vertexColors[1] = dfColors[i-1]
                    newFace.vertexColors[2] = dfColors[i]
                    geometry.faces.push(newFace)
                }*/

                geometry.colors.push(dfColors[i])
            }

            let newDataPointSprites = new THREE.Line(geometry, material)

            group.add(newDataPointSprites)

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
                
            let isItValid = this.IsPlotmeshValid("scatterplot")
        
            // laod the recently used material from the cache
            let material = this.dfCache.material

            // the material is created here
            if(material === undefined || !isItValid || material != undefined && material != dataPointSize)
            {
                // only dispose the old mesh if it is not used anymore
                if(!keepOldPlot)
                {
                    this.SceneHelper.disposeMesh(this.plotmesh)
                    this.plotmesh = new THREE.Group()
                    this.plotmesh.name = "scatterplot"
                    this.SceneHelper.scene.add(this.plotmesh)
                }

                /*// create a new material, draw a circle on it
                let canvas = document.createElement("canvas")
                let context = canvas.getContext("2d")
                canvas.width = 64
                canvas.height = 64
                // https://github.com/mrdoob/three.js/issues/1625
                // context.fillStyle = "white"
                // context.fillRect(0,0,64,64)
                // context.globalCompositeOperation = "destination-in";
                context.beginPath()
                context.arc(32, 32, 30, 0, 2*Math.PI)
                context.fillStyle = "white"
                context.fill()
                let datapointSprite = new THREE.Texture(canvas)*/
        
                // base64 created using tools/getBase64.html and tools/sprite.png
                let circle = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQMAAACQp+OdAAAABlBMVEUAAAD///+l2Z/"+
                "dAAAAAXRSTlMAQObYZgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfhChkUDA4mTwuUAAAAHWlUWHR"+
                "Db21tZW50AAAAAABDcmVhdGVkIHdpdGggR0lNUGQuZQcAAACJSURBVCjPvZK7DcAgDESJUlAyAqMwGhktozACJUWEE+fQORJSlCp"+
                "ueJI/wnd27hHpwLuK7DcEkYqMCHJyxShBkVcoqEV1VGhoQltW6KNb+xfAhjE6iOABxSAAqkEENIMEON4gA/of8OU/8xbzprMas2I"+
                "Uk/Ka4LSAptAmGkcraa7ZzQPgSfBIECf/CnPyltYpaAAAAABJRU5ErkJggg=="

                let datapointSprite = new THREE.TextureLoader().load(circle)
                //let datapointSprite = new THREE.ImageUtils.loadTexture(circle)
                datapointSprite.needsUpdate = true
                // plot it using circle sprites

                datapointSprite.magFilter = THREE.NearestFilter
                datapointSprite.minFilter = THREE.NearestFilter


                // https:// github.com/mrdoob/three.js/issues/1625
                // alphaTest = 1 causes errors
                // alphaTest = 0.9 edgy picture
                // alphaTest = 0.1 black edges on the sprite
                // alphaTest = 0 not transparent infront of other sprites anymore
                // sizeAttenuation: false, sprites don't change size in distance and size is in px
                material = new THREE.PointsMaterial({
                    size: dataPointSize,
                    map: datapointSprite,
                    transparent: true,
                    alphaTest: 0.5,
                    vertexColors: true,
                })

                this.dfCache.material = material
            }

            let group = this.plotmesh
            let geometry = new THREE.Geometry()
            
            for(let i = 0; i < df.length; i ++)
            {
                let vertex = new THREE.Vector3()
                vertex.x = (df[i][x1col]-minX1)/x1frac*this.dimensions.xLen
                vertex.y = (df[i][x2col]-minX2)/x2frac*this.dimensions.yLen
                vertex.z = (df[i][x3col]-minX3)/x3frac*this.dimensions.zLen

                // three.js handles invalid vertex already by skipping them
                geometry.vertices.push(vertex)
                geometry.colors.push(dfColors[i])
            }

            geometry.verticesNeedUpdate = true

            let newDataPointSprites = new THREE.Points(geometry, material)

            group.add(newDataPointSprites)
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

        // those are always handy to remember and they are needed in some cases
        this.dfCache.normalization.x1frac = x1frac
        this.dfCache.normalization.x2frac = x2frac
        this.dfCache.normalization.x3frac = x3frac

        if(updateCache === true) // if updating is allowed. is only important for the dataframe basically
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

        this.SceneHelper.makeSureItRenders(this.animationFunc)

        //updating the axes. Only update them when the numbers actually change
        if(this.dfCache.normalization.minX1 !== minX1 ||
            this.dfCache.normalization.maxX1 !== maxX1 ||
            this.dfCache.normalization.minX2 !== minX2 ||
            this.dfCache.normalization.maxX2 !== maxX2 ||
            this.dfCache.normalization.minX3 !== minX3 ||
            this.dfCache.normalization.maxX3 !== maxX3)
        {
            
            this.dfCache.normalization = {}
            this.dfCache.normalization.minX1 = minX1
            this.dfCache.normalization.maxX1 = maxX1
            this.dfCache.normalization.minX2 = minX2
            this.dfCache.normalization.maxX2 = maxX2
            this.dfCache.normalization.minX3 = minX3
            this.dfCache.normalization.maxX3 = maxX3

            if(mode === "barchart")
            {
                // because barcharts are not normalized in the way, that the highest bar is as high as yLen and that the lowest is flat (0) (like scatterplots)
                // they have negative bars. So they are normalized a little bit differently. So the axes have to be numbered in a slightly different way
                // minX2 is important for the positioning of the axis number. But in the case of barcharts, it needs to be 0, because the whole plot is not moved
                // to the top by minX1. updateAxesNumbers basically recreates the height of the highest bar/datapoint in the 3D space.
                // barcharts: let ypos = normalization.maxX2 / normalization.x2frac * yLen
                // default: let ypos = (normalization.maxX2 - normalization.minX2) / normalization.x2frac * yLen
                let normalization = this.dfCache.normalization
                normalization.minX2 = 0
                if(this.SceneHelper.axes != undefined)
                    this.SceneHelper.updateAxesNumbers(this.dimensions, normalization, numberDensity)
            }
            else
            {
                if(this.SceneHelper.axes != undefined)
                    this.SceneHelper.updateAxesNumbers(this.dimensions, this.dfCache.normalization, numberDensity)
            }
        }
    }



    /**
     * repeats the drawing using the dataframe memorized in dfCache, but adds a new datapoint to it
     * @param {any} newDatapoint Array that contains the attributes of the datapoints in terms of x1, x2, x3, x4, x5 etc.
     * @param {object} options
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
    addDataPoint(newDatapoint, options={})
    {
        if(this.dfCache === undefined)
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
        this.dfCache.options.maxX1

        // those default values are important to be like this.
        if(options.normalizeX1 === undefined)
            this.dfCache.options.normalizeX1 = false
        if(options.normalizeX2 === undefined)
            this.dfCache.options.normalizeX2 = false
        if(options.normalizeX3 === undefined)
            this.dfCache.options.normalizeX3 = false
        if(this.dfCache.options.normalizeX1 || this.dfCache.options.normalizeX2 || this.dfCache.options.normalizeX3)
            console.warn("addDataPoint with turned on normalization options will not align the new datapoint with the old plots normalization.")

        // create the datapoint data structure (an array) from this
        if(typeof(newDatapoint) === "string")
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
     * updates the legend with new information. basically recreates the innerHTML of this.legend.element
     * @param {object} colorMap COLORLIB.getColorMap(...) information. can be null
     * @param {object} options json object containing one or more of x1title, x2title, x3title and title
     */
    populateLegend(options)
    {
        // update the legend with the label color information
        // open legend, add title
        let legendHTML = ""
        if(options.title != undefined && options.title != "")
            legendHTML += "<h1>"+options.title+"</h1>"

        // add info about the labels and the colors
        if(options.colorMap != undefined && options.colorMap.labelColorMap != {})
        {
            // label colors:
            legendHTML += "<table class=\"jsP3D_labelColorLegend\"><tbody>" // can't append to innerHTML directly for some funny reason
            for(let key in options.colorMap.labelColorMap)
            {
                legendHTML += "<tr>"
                legendHTML += "<td><span class=\"jsP3D_labelColor\" style=\"background-color:#" + options.colorMap.labelColorMap[key].getHexString() + ";\"></span></td>"
                legendHTML += "<td>" + key + "</td>"
                legendHTML += "</tr>"
            }
            legendHTML += "</tbody></table>"
        }

        // axes titles:
        legendHTML += "<table class=\"jsP3D_axesTitleLegend\"><tbody>"
        if(options.x1title != undefined)
            legendHTML += "<tr><td>x:</td><td>"+options.x1title+"</td></tr>"
        if(options.x2title != undefined)
            legendHTML += "<tr><td>y:</td><td>"+options.x2title+"</td></tr>"
        if(options.x3title != undefined)
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
        this.legend.colors = {}
    }



    /**
     * resets the legend content and removes it from the DOM.
     */
    resetLegend()
    {
        this.legend.element.parentElement.removeChild(this.legend.element)
        this.initializeLegend()
    }



    /**
     * appends the legend to a specific container. Make sure to style it using the css of your website because otherwise the colored span elements will not be visible.
     * @param {DOM} container
     * @return returns the dom element of the legend
     */
    createLegend(container)
    {
        if(container === null || container === undefined)
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

        if(obj === undefined)
        {
            this.redraw = false
            return false
        }
            
        // it either has children because it's a group it has a geometry. if both are undefined, it's not valid anymore.

        if(this.redraw === true) // this is the only place where this.redraw is taken into account
        {
            this.SceneHelper.disposeMesh(obj)
            this.redraw = false
            return false
        }


        if(obj.name === check)
            return true

        if(obj.type === check)
            return true

            
        this.SceneHelper.disposeMesh(obj)
        this.redraw = false
        return false
    }



    /**
     * clears the cache and initializes it
     * @private
     */
    resetCache()
    {
        this.dfCache = {}

        this.dfCache.normalization = {}
    
        this.dfCache.material = undefined
        this.dfCache.dataframe = []
        this.dfCache.x1col = 0
        this.dfCache.x2col = 1
        this.dfCache.x3col = 2
        this.dfCache.checkstring = ""
        this.dfCache.options = {}
        this.dfCache.minX2 = undefined
        this.dfCache.maxX2 = undefined
        this.dfCache.barsGrid = undefined
    }



    /**
     * returns the cache
     */
    getCache()
    {
        if(this.dfCache === undefined)
            resetCache()
        return this.dfCache
    }


    /**
     * changes the background color and triggers a rerender
     * @param {string} color
     */
    setBackgroundColor(color)
    {
        this.SceneHelper.setBackgroundColor(color)
    }



    /**
     * Creates new axes with the defined color and triggers a rerender
     * @param {String} color    axes color. Examples: 0xffffff, "#ff6600", "rgb(1,0.5,0)", "hsl(0.7,0.6,0.3)"
     */
    setAxesColor(color)
    {
        this.SceneHelper.createAxes(color, this.dimensions, this.dfCache.normalization)
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
     * gets the DOM container of this plot
     * @return {object} the DOM-Element that contains the plot
     */
    getContainer()
    {
        return this.container
    }



    /**
     * not used for initialization, but rather for changing dimensions during runtime. will trigger axes recreation
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

        this.dimensions.xVerticesCount = Math.max(1, Math.round(this.dimensions.xLen*this.dimensions.xRes))
        this.dimensions.zVerticesCount = Math.max(1, Math.round(this.dimensions.zLen*this.dimensions.zRes))

        if(this.axes != undefined) //check that because axes might have been removed at some point manually using removeAxes()
            this.SceneHelper.createAxes(this.axesColor) // recreate
    

        // move
        this.SceneHelper.centerCamera(this.dimensions)
        this.SceneHelper.updateAxesSize(this.dimensions,this.dfCache.normalization)

        // vertices counts changed, so the mesh has to be recreated
        this.redraw = true

        // takes effect once the mesh gets created from new, except for the lengths indicated by the axes. those update immediatelly
        //this.SceneHelper.render()
    }



    /**
     * returns a JSON object that contains the dimensions
     * @return {object} {xRes, zRes, xLen, yLen, zLen, xVerticesCount, zVerticesCount, minX1, maxX1, minX2, maxX2, minX3, maxX3}
     */
    getDimensionsAndNormalization()
    {
        let dimensions = this.dimensions

        //merge the normalization info into dimensions
        for(let key in this.dfCache.normalization)
            dimensions[key] = this.dfCache.normalization[key]

        return this.dimensions
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
        this.SceneHelper.onChangeCamera = function() {}
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
            this.SceneHelper.render()
        }
        requestAnimationFrame(()=>this.callAnimation())
    }



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



    /**
     * removes the axes. They can be recreated using createAxes(color)
     */
    removeAxes()
    {
        this.SceneHelper.removeAxes()
    }
}
