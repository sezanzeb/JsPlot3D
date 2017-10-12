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
     * 
     * @param {object} container     html div DOM element which can then be selected using
     *                               - Plot(document.getElementById("foobar"))
     * @param {json}   options       at least one of backgroundClr or axesClr in a Json Format {}. Colors can be hex values "#123abc" or 0x123abc
     */
    constructor(container, options={})
    {

        //parameter checking
        let backgroundColor = 0xffffff
        let axesColor = 0x000000
        if(typeof(container) != "object")
            return console.error("second param for the Plot constructor (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")

        //some plotdata specific variables. I want setters and getter for all those at some point
        this.MathParser = new MathParser()
        this.resetCalculation() //configures the variables
        this.dataPointImage = "datapoint.png"
        this.ColorManager = new ColorManager(THREE)

        if(options.backgroundColor != undefined)
            backgroundColor = options.backgroundColor
        if(options.axesColor != undefined)
            axesColor = options.axesColor

        //check if dataPointImage is available
        let img = new Image()
        img.onerror = ()=>console.warn(this.dataPointImage+" does not exist. Scatterplots will not be visible")
        img.src = this.dataPointImage


        //three.js setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setClearColor(this.ColorManager.getColorObjectFromAnyString(backgroundColor))
        this.setContainer(container)
        this.scene = new THREE.Scene()
        
        
        //boundaries and dimensions of the plot data
        this.setDimensions({xLen:1,yLen:1,zLen:1,xRes:20,zRes:20})
        this.createLight()
        this.createAxes(axesColor)
        this.createArcCamera()
        this.render()

        //this.enableBenchmarking()

        window.setInterval(()=>this.render(),32)
    }
    


    /**
     * plots a formula into the container
     * 
     * @param {string}  originalFormula string of formula
     * @param {string}  mode     "barchart", "polygon" or "scatterplot". Changes the way the data gets displayed
     * @param {number}  dataPointSize Default 0.02. In case mode is "scatterplot" it changes the size of the datapoints
     */
    plotFormula(originalFormula, mode, dataPointSize=0.02)
    {       
        if(originalFormula == undefined || originalFormula == "")
            return console.error("first param of plotFormula (originalFormula) is undefined or empty")
        if(typeof(originalFormula) != "string")
            return console.error("first param of plotFormula (originalFormula) should be string")

        this.resetCalculation()
        this.parsedFormula = this.MathParser.parse(originalFormula)
        
        if(mode == "scatterplot") //3D-Plane
        {

            ////////  SCATTERPLOT    ////////

            //if scatterplot, create a dataframe and send it to plotDataFrame
            let df = new Array(this.xVerticesCount * this.zVerticesCount)

            //the three values that are going to be stored in the dataframe
            let y = 0
            let x = 0
            let z = 0

            //line number in the new dataframe
            let i = 0

            for(let x = 0; x < this.xVerticesCount; x++)
            {
                for(let z = 0; z < this.zVerticesCount; z++)
                {
                    y = this.f(x/this.xRes,z/this.zRes) //calculate y. y = f(x1,x2)
                    df[i] = [x,y,z] //store the datapoint
                    i++
                }
            }
            let options = {
                mode: mode,
                colorCol: 1, //y
                normalizeX2: false,
                dataPointSize: dataPointSize
            }

            //continue plotting this DataFrame
            this.plotDataFrame(df, 0, 1, 2, options)
        }
        else if(mode == "barchart")
        {


            ////////  BARCHART ////////


            //if scatterplot, create a dataframe and send it to plotDataFrame
            let df = new Array(this.xVerticesCount * this.zVerticesCount)

            //the three values that are going to be stored in the dataframe
            let y = 0
            let x = 0
            let z = 0

            //line number in the new dataframe
            let i = 0

            for(let x = 0; x < this.xVerticesCount; x++)
            {
                for(let z = 0; z < this.zVerticesCount; z++)
                {
                    y = this.f(x/this.xRes,z/this.zRes) //calculate y. y = f(x1,x2)
                    df[i] = [x,y,z] //store the datapoint
                    i++
                }
            }
            let options = {
                mode: mode,
                colorCol: 1, //y
                normalizeX2: false,
                dataPointSize: dataPointSize
            }
            
            //continue plotting this DataFrame
            this.plotDataFrame(df, 0, 1, 2, options)
        }
        else
        {

            if(mode != "polygon" && mode != undefined)
                console.warn("mode \""+mode+"\" unrecognized. Assuming \"polygon\"")

            ////////  POLYGON ////////


            //might need to recreate the geometry and the matieral
            //is there a plotmesh already? Or maybe a plotmesh that is not created from a 3D Plane (could be a scatterplot or something else)
            if(!this.IsPlotmeshValid() || this.plotmesh.geometry.type != "PlaneGeometry")
            {
                this.disposeMesh(this.plotmesh)

                //create plane, divided into segments
                let planegeometry = new THREE.PlaneGeometry(this.xLen,this.zLen,this.xRes,this.zRes)
                //move it
                planegeometry.rotateX(Math.PI/2)
                planegeometry.translate(this.xLen/2,0,this.zLen/2)

                //color the plane
                let plotmat = new THREE.MeshStandardMaterial({
                    color: 0xff3b00,
                    emissive: 0x2f7b8c,
                    roughness: 0.8,
                    //wireframe: true,
                    side: THREE.DoubleSide
                    })

                /*let plotmat = new THREE.MeshBasicMaterial({
                    vertexColors: THREE.VertexColors,
                    side: THREE.DoubleSide
                })*/

                this.plotmesh = new THREE.Mesh(planegeometry, plotmat)
                this.scene.add(this.plotmesh)
            }
            //if not, go ahead and manipulate the vertices

            //TODO hiding faces if typeof y is not number:
            //https://stackoverflow.com/questions/11025307/can-i-hide-faces-of-a-mesh-in-three-js

            //modifying vertex positions:
            //https://github.com/mrdoob/three.js/issues/972
            let y = 0
            let vIndex = 0
            for(let z = this.zVerticesCount-1; z >= 0; z--)
                for(let x = 0; x < this.xVerticesCount; x++)
                {
                    y = this.f(x/this.xRes,z/this.xRes)
                    this.plotmesh.geometry.vertices[vIndex].y = y
                    this.plotmesh.geometry.colors[vIndex] = new THREE.Color(0x6600ff)
                    vIndex ++
                }
                
            //normals need to be recomputed so that the lighting works after the transformation
            this.plotmesh.geometry.computeFaceNormals()
            this.plotmesh.geometry.computeVertexNormals()
            this.plotmesh.geometry.__dirtyNormals = true
            //make sure the updated mesh is actually rendered
            this.plotmesh.geometry.verticesNeedUpdate = true

        }
    }
    
    
    
    /**
     * plots a .csv string into the container
     *
     * @param {string}  sCsv        string of the .csv file, e.g."a;b;c\n1;2;3\n2;3;4"
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: 0
     * @param {number}  x2col       column index used for transforming the x2 axis (y). default: 1
     * @param {number}  x3col       column index used for plotting the x3 axis (z). default: 2
     * @param {object}  options     json object with one or more of the following parameters:
     * - separator {string}: separator used in the .csv file. e.g.: "," or ";" as in 1,2,3 or 1;2;3
     * - header {boolean}: a boolean value whether or not there are headers in the first row of the csv file. Default true
     * - mode {string}: "barchart" or "scatterplot"
     * - colorCol {number}: leave undefined or set to -1, if defaultColor should be applied. Otherwise the index of the csv column that contains color information. 
     *                      (0, 1, 2 etc.). Formats of the column within the .csv file allowed:
     *                      numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically.
     *                      Integers that are used as class for labeled data would result in various different hues in the same way.
     *                      hex strings ("#f8e2b9"). "rgb(...)" strings. "hsl(...)" strings. strings as labels (make sure to set labeled = true).
     * - normalizeX1 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X1 Axis
     * - normalizeX2 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X2 Axis (y)
     * - normalizeX3 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X3 Axis
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - labeled {boolean}: true if colorCol contains labels (such as 0, 1, 2 or frog, cat, dog). This changes the way it is colored.
     *                      Having it false on string-labeled data will throw a warning, but it will continue as it was true
     * - defaultColor {number or string}: examples: #1a3b5c, 0xfe629a, rgb(0.1,0.2,0.3), hsl(0.4,0.5,0.6). Gets applied when either colorCol is -1, undefined or ""
     * - maxX1 {number}: the maximum x1 value in the dataframe. The maximum value in the column that is used as x1. Default 1
     * - maxX2 {number}: the maximum x2 value in the dataframe. The maximum value in the column that is used as x2. Default 1 (y)
     * - maxX3 {number}: the maximum x3 value in the dataframe. The maximum value in the column that is used as x3. Default 1
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.02
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated 
     *                      as if it was a color. (converted to hexadecimal then). Default false
     */
    plotCsvString(sCsv, x1col, x2col, x3col, options)
    {
        //---------------------------//
        //  parameter type checking  //    
        //---------------------------//

        //a more complete checking will be done in plotDataFrame once the dataframe is generated.
        //only check what is needed in plotCsvString

        //default config
        let separator=","
        let header=false
        let title=""
        let fraction=1

        //some helper functions
        let errorParamType = (varname, variable, expectedType) => console.error("expected '"+expectedType+"' but found '"+typeof(variable)+"' for "+varname+" ("+variable+")")
        let checkBoolean = (varname, variable) => {
            if(variable == undefined)
                return //not defined in the (optional) options, don't do anything then
            let a = (variable == true || variable == false)
            if(!a) errorParamType(varname, variable, "boolean")
            return(a) //returns true (valid) or false
        }
        let checkNumber = (varname, variable) => {
            if(variable == undefined || variable == "")
                return //not defined in the (optional) options, don't do anything then
            if(typeof(variable) != "number" && isNaN(parseFloat(variable)))
                return errorParamType(varname, variable, "number")
            else return true //returns true (valid) or false
        }

        //make sure options is defined
        if(typeof(options) == "object")
        {
            //seems like the user sent some parameters. check them

            //treat empty strings as if it was undefined in those cases:
            if(options.separator == "")
                options.separator = undefined

            //check numbers. Overwrite if it's good. If not, default value will remain
            if(checkNumber("fraction",options.fraction))
                fraction = parseFloat(options.fraction)

            //check booleans. Overwrite if it's good. If not, default value will remain
            if(checkBoolean("header",options.header))
                header = options.header

            //check everything else
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

        //still the same data?
        //create a very quick checksum sort of string
        let stepsize = parseInt(sCsv.length/20)
        let samples = ""
        for(let i = 0;i < sCsv.length; i+=stepsize)
            samples = samples + sCsv[i]

        //take everything into account that changes how the dataframe looks after the processing
        let checkstring = title+sCsv.length+samples+fraction+header+separator

        //now check if the checksum changed. If yes, remake the dataframe from the input
        if(this.dfCache == undefined || this.dfCache.checkstring != checkstring)
        {
            //new csv arrived:

            //transform the sCsv string to a dataframe
            let data = sCsv.split("\n")
            data = data.slice(0,data.length-data.length*(1-fraction))
            let headerRow = ""
            
            if(data[0] == "") //to prevent an error I have encountered when reading a csv from DOM Element innerHTML.
            //This probably happens when the csv data starts one line below the opening bracket of the Element
                data = data.slice(-(data.length-1))
            if(data[data.length-1] == "")
                data.pop()

            //find out the separator automatically if the user didn't define it
            if(options.separator == undefined || data[0].indexOf(separator) == -1)
            {
                //in case of undefined or -1, assume ;, then try ,
                separator = ";"

                if(data[0].indexOf(separator) == -1)
                    separator = ","
                    
                if(data[0].indexOf(separator) == -1)
                    return console.error("no csv separator/delimiter was detected. Please set separator=\"...\" according to your file format: \""+data[0]+"\"")

                
                console.warn("the specified separator/delimiter was not found. Tried to detect it and came up with \""+separator+"\". Please set separator=\"...\" according to your file format: \""+data[0]+"\"")
            }

            if(options["header"] == undefined)
            {
                //find out automatically if they are headers or not
                //take x1col, check first line type (string/NaN?) then second line type (number/!NaN?)
                //if both are yes, it's probably header = true
                if(isNaN(data[0].split(separator)[x1col]) && !isNaN(data[1].split(separator)[x1col]))
                {
                    console.log("detected headers, first csv line is not going to be plotted therefore. To prevent this, set header=false")
                    header = true
                }
            }

            if(header)
            {
                headerRow = data[0]
                //remove leading and ending whitespaces in headers
                for(let j = 0;j < headerRow.length; j++)
                   headerRow[j].trim()

                //start at line index 1 to skip the header
                for(let i = 1;i < data.length; i ++)
                {
                    data[i-1] = data[i].split(separator) //overwrite the header (-1)
                    //remove leading and ending whitespaces in data
                    for(let j = 0;j < data[i].length; j++)
                        data[i][j].trim()
                }
                data.pop() //because there will be one undefined value in the array
            }
            else
            {
                for(let i = 0;i < data.length; i ++)
                {
                    data[i] = data[i].split(separator)
                    //remove leading and ending whitespaces in data
                    for(let j = 0;j < data[i].length; j++)
                        data[i][j].trim()
                }
            }

            //cache the dataframe. If the same dataframe is used next time, don't parse it again
            this.dfCache = {}
            this.dfCache.dataframe = data
            this.dfCache.checkstring = checkstring

            this.benchmarkStamp("created the dataframe and cached it")

            //plot the dataframe.
            options.header = false //header is already removed
            options.fraction = 1 //Fraction is now 1, because the fraction has already been taken into account

            this.plotDataFrame(data, x1col, x2col, x3col, options)
        }
        else
        {
            console.log("using cached dataframe")
            //cached
            //this.dfCache != undefined and checkstring is the same
            //same data. Fraction is now 1, because the fraction has already been taken into account
            this.plotDataFrame(this.dfCache.dataframe, x1col, x2col, x3col, options)
        }
    }
    

    
    /**
     * plots a dataframe on the canvas element which was defined in the constructor of Plot()
     *
     * @param {number[][]}  df      int[][] of datapoints. [row][column]
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: 0
     * @param {number}  x2col       column index used for transforming the x2 axis (y). default: 1
     * @param {number}  x3col       column index used for plotting the x3 axis (z). default: 2
     * @param {object}  options     json object with one or more of the following parameters:
     * - mode {string}: "barchart" or "scatterplot"
     * - header {boolean}: a boolean value whether or not there are headers in the first row of the csv file. Default true
     * - colorCol {number}: leave undefined or set to -1, if defaultColor should be applied. Otherwise the index of the csv column that contains color information. 
     *                      (0, 1, 2 etc.). Formats of the column within the .csv file allowed:
     *                      numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically.
     *                      Integers that are used as class for labeled data would result in various different hues in the same way.
     *                      hex strings ("#f8e2b9"). "rgb(...)" strings. "hsl(...)" strings. strings as labels (make sure to set labeled = true).
     * - normalizeX1 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X1 Axis
     * - normalizeX2 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X2 Axis (y)
     * - normalizeX3 {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then on the X3 Axis
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - labeled {boolean}: true if colorCol contains labels (such as 0, 1, 2 or frog, cat, dog). This changes the way it is colored.
     *                      Having it false on string-labeled data will throw a warning, but it will continue as it was true
     * - defaultColor {number or string}: examples: #1a3b5c, 0xfe629a, rgb(0.1,0.2,0.3), hsl(0.4,0.5,0.6). Gets applied when either colorCol is -1, undefined or ""
     * - maxX1 {number}: the maximum x1 value in the dataframe. The maximum value in the column that is used as x1. Default 1
     * - maxX2 {number}: the maximum x2 value in the dataframe. The maximum value in the column that is used as x2. Default 1 (y)
     * - maxX3 {number}: the maximum x3 value in the dataframe. The maximum value in the column that is used as x3. Default 1
     * - barchartPadding {number}: how much space should there be between the bars? Example: 0.025
     * - dataPointSize {number}: how large the datapoint should be. Default: 0.02
     * - filterColor {boolean}: true: if the column with the index of the parameter "colorCol" contains numbers they are going to be treated 
     *                      as if it was a color. (converted to hexadecimal then). Default false
     */
    plotDataFrame(df, x1col=0, x2col=1, x3col=2, options={})
    {
        //---------------------------//
        //  parameter type checking  //
        //---------------------------//
        //default config
        let header=false
        let colorCol=-1
        let mode="scatterplot"
        let normalizeX1=true
        let normalizeX2=true
        let normalizeX3=true
        let title=""
        let fraction=1
        let labeled=false
        let defaultColor=0 //black
        let barchartPadding=0.5/this.xRes
        let dataPointSize=0.02
        let filterColor=true
        //max in terms of "how far away is the farthest away point"
        let maxX1=1
        let maxX2=1
        let maxX3=1

        //when true, the dataframe is a 2D Array an can be accessed like this: df[x][z] = y
        //it's experiemental and does not work yet for all plotting modes. It's there for performance increasing
        //because sometimes I am calculating a dataframe from a formula and then convert it to that [x][z] shape
        //instead of calculating this shape right away
        let dfIsA2DMap=false

        //some helper functions
        let errorParamType = (varname, variable, expectedType) => console.error("expected '"+expectedType+"' but found '"+typeof(variable)+"' for "+varname+" ("+variable+")")
        let checkBoolean = (varname, variable) => {
            if(variable == undefined)
                return false//not defined in the (optional) options, don't do anything then
            let a = (variable == true || variable == false)
            if(!a)
            { errorParamType(varname, variable, "boolean"); return false }   
            return(a) //returns true (valid) or false
        }
        let checkNumber = (varname, variable) => { //returns true if it is a number, false if it is either not defined or not a number
            if(variable == undefined || variable === "")
                return false  //not defined in the (optional) options, don't do anything then
            if(typeof(variable) != "number" && isNaN(parseFloat(variable)))
            { errorParamType(varname, variable, "number"); return false }
            return true //returns true (valid) or false
        }

        //make sure options is defined
        if(typeof(options) == "object")
        {
            //seems like the user sent some parameters. check them

            //treat empty strings as if it was undefined in those cases:
            if(options.colorCol == "")
                options.colorCol = undefined

            //check numbers. Overwrite if it's good. If not, default value will remain
            if(options.colorCol != undefined && options.colorCol >= df[0].length)
            {
                console.error("column with index "+options.colorCol+", used as colorCol, is not existant in the dataframe. Disabling coloration")
                options.colorCol = -1
            }
            if(checkNumber("fraction",options.fraction))
                fraction = parseFloat(options.fraction)
            if(checkNumber("barchartPadding",options.barchartPadding))
                barchartPadding = parseInt(options.barchartPadding)

            if(checkNumber("maxX1",options.maxX1))
                maxX1 = parseFloat(options.maxX1)
            if(checkNumber("maxX2",options.maxX2))
                maxX2 = parseFloat(options.maxX2)
            if(checkNumber("maxX3",options.maxX3))
                maxX3 = parseFloat(options.maxX3)
            if(checkNumber("colorCol",options.colorCol))
                colorCol = parseFloat(options.colorCol)
            if(checkNumber("dataPointSize",options.dataPointSize))
                dataPointSize = parseFloat(options.dataPointSize)

            //check booleans. Overwrite if it's good. If not, default value will remain
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
                
            //check everything else
            if(options.title != undefined)
                title = options.title
            if(options.defaultColor != undefined)
                defaultColor = options.defaultColor
            if(options.mode != undefined)
                mode = options.mode
        }
        
        //be vault tolerant for the columns. assume 0, 1 and 2 if possible
        if(x1col == "")
            x1col = 0
        if(x2col == "")
            x2col = 1
        if(x3col == "")
            x3col = 2
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
            console.error("one of the colum indices is out of bounds. The maximum index in this dataframe is "+(df[0].length-1)+". x1col: "+x1col+" x2col:"+x2col+" x3col:"+x3col)
        //detct the rightmost column index that contains numberes
        let maximumColumn = 2 //to match the default settings of 0, 1 and 2, start at 2
        for(;maximumColumn >= 0; maximumColumn--)
            if(!isNaN(parseFloat(df[1][maximumColumn])))
                break
        x1col = Math.min(x1col,maximumColumn)
        x2col = Math.min(x2col,maximumColumn)
        x3col = Math.min(x3col,maximumColumn)
        

        //remove the old mesh
        this.resetCalculation()
        if(this.plotmesh != undefined)
        {
            this.disposeMesh(this.plotmesh)
        }

        //-------------------------//
        //     coloring labels     //    
        //-------------------------//
        //creates an array "dfColors" that holds the color information
        //(unnormalized numbers or color strings (#fff,rgb,hsl)) for each vertex (by index)

        let dfColors = this.ColorManager.getColorMap(df,colorCol,defaultColor,labeled,header,filterColor)
        if(dfColors == -1)
        {
            //ColorManager tells us to restart
            labeled = true
            options.labeled = labeled
            this.plotDataFrame(df, x1col, x2col, x3col, options)
            return
        }

        //by this point only dfColors stays relevant. So the function above can be easily moved to a different class to clear up the code here

        //-------------------------//
        //       normalizing       //    
        //-------------------------//
        //finds out by how much the values (as well as colors) to divide and for the colors also a displacement


        //normalize, so that the farthest away point is still within the xLen yLen zLen frame
        //TODO logarithmic normalizing
        if(normalizeX1)
        {
            maxX1 = 0
            //determine max for normalisation
            for(let i = 0; i < df.length; i++)
            {
                //max in terms of "how far away is the farthest away point"
                //in the df are only strings. Math.abs not only makes it positive, it also parses that string to a number
                if(Math.abs(df[i][x1col]) > maxX1)
                    maxX1 = Math.abs(df[i][x1col])
            }
        }
        if(normalizeX2)
        {
            maxX2 = 0
            for(let i = 0; i < df.length; i++)
            {
                if(Math.abs(df[i][x2col]) > maxX2)
                    maxX2 = Math.abs(df[i][x2col])
            }
        }
        if(normalizeX3)
        {
            maxX3 = 0
            for(let i = 0; i < df.length; i++)
            {
                if(Math.abs(df[i][x3col]) > maxX3)
                    maxX3 = Math.abs(df[i][x3col])
            }
        }

        this.benchmarkStamp("normalized the data")
        
        if(mode == "barchart")
        {
            //-------------------------//
            //        Bar Chart        //    
            //-------------------------//
            
            //plot it using circle sprites
            let geometry = new THREE.Geometry()
            let sprite = new THREE.TextureLoader().load(this.dataPointImage)
            //https://github.com/mrdoob/three.js/issues/1625
            sprite.magFilter = THREE.LinearFilter
            sprite.minFilter = THREE.LinearFilter

            let cubegroup = new THREE.Group()

            //dimensions of the bars
            let barXWidth = 1/this.xRes
            let barZWidth = 1/this.zRes
            if(barchartPadding > barXWidth || barchartPadding > barZWidth)
                console.warn("barchartPadding might be too large. Try a maximum value of "+Math.min(barXWidth,barZWidth))


            //bars shouldn't overlap but rather fit to the grid. For this a few steps have to be undertaken:


            //now create an array that has one element for each bar. Bars are aligned in a grid of this.xRes and this.zRes elements
            let barHeights = new Array(this.xVerticesCount)
            for(let x = 0; x < barHeights.length; x++)
                barHeights[x] = new Array(this.zVerticesCount)

            let minX2 = 0 //to calculate the heatmap, this is needed aswell
                maxX2 = 0 //reset max height, as it will be overwritten

            //fill the barHeights array with the added heights of the bars
            for(let i = 0; i < df.length; i ++)
            {
                //get coordinates that can fit into an array tis.x
                let x = parseInt(df[i][x1col]/maxX1*this.xRes)
                let z = parseInt(df[i][x3col]/maxX3*this.zRes)

                let y = parseFloat(df[i][x2col]) //don't normalize yet

                if(barHeights[x] != undefined) //does the datapoint fit into the frame? TODO this should also plot when the datapoint is somewhere else or something
                {
                    if(barHeights[x][z] != undefined)
                    {
                        barHeights[x][z] += y
                    }
                    else
                    {
                        barHeights[x][z] = y
                    }
                    //get the new maximum and minimum
                    if(barHeights[x][z] > maxX2)
                        maxX2 = barHeights[x][z]
                    if(barHeights[x][z] < minX2)
                        minX2 = barHeights[x][z]
                }
            }
            
            let normalizationValue = Math.max(maxX2,Math.abs(minX2))
            if(!normalizeX2)
                normalizationValue = 1
            if(normalizationValue == 0)
                return console.error("your dataframe does not contain any information. The maximum amplitude in your barchart is 0 therefore")

            //now iterate over the barHeights array and plot the bars according to their stored height
            for(let x = 0; x < barHeights.length; x++)
                for(let z = 0; z < barHeights[x].length; z++)
                {
                    //retreive the bar height and nomralize it
                    let y = barHeights[x][z]/normalizationValue //now normalize
                    
                    if(!isNaN(y) && y != undefined)
                    {
                        //create the bar
                        let shape = new THREE.CubeGeometry(1/this.xRes-barchartPadding,Math.abs(y),1/this.zRes-barchartPadding)
                        shape.translate(x/this.xRes,y/2,z/this.zRes) //move it to the right position

                        //get a heatmap like color scheme
                        let color = this.ColorManager.convertToHeat(y,minX2/normalizationValue,maxX2/normalizationValue)
    
                        let plotmat = new THREE.MeshStandardMaterial({
                            color: color,
                            emissive: color,
                            roughness: 1,
                            })
    
                        cubegroup.add(new THREE.Mesh(shape,plotmat))
                    }
                }

            this.disposeMesh(this.plotmesh)
            this.plotmesh = cubegroup
            this.scene.add(cubegroup)
            this.benchmarkStamp("made a bar chart")

        }
        else if(mode == "polygon")
        {

            //-------------------------//
            //       3D-Mesh Plot      //    
            //-------------------------//

            //I unfortinatelly think this can't work
            
            //(as long as the datapoint coordinates are not grid like.)
            //if they are, the code would have to detect the resolution and then an easy algorithm can be run over the
            //datapoints to connect triangles with the nearest vertices and leave those out that are not existant

            //I could try to align the datapoints to a grid and maybe even interpolating it, but when there are only few datapoints
            //in some parts of the "landscape", there won't be a polygon created, because there would still be spaces in the grid

            //the only way i can think of would be a "density based clustering like with a dynamic radius" kind of approach that checks for intersections
            //because edges should not cross each other. It would be ridiculously complex and I really don't have the time for that during my studies

            //one could also:
            //1. align the scattered datapoints to a grid (interpolated, that means add the datapoints y-value to nearby grid positions mulitplied with the distance)
            //2. connect triangles when datapoints are directly next to each other (go clockwise around the grid positions that are one step away)
            //3. datapoints that are still don't connected to anything receive a circle sprite OR connect themself to the 2 nearest vertices


        }
        else if(mode == "linechart")
        {

            //-------------------------//
            //        lineplot         //    
            //-------------------------//

            //iterate over dataframe datapoints, connect the latest point with the new one
            //  +---+---+---+--> +   +   +
            //it goes zig zag through the 3D Space


        }
        else
        {
            if(mode != "scatterplot" && mode != undefined)
                console.warn("mode \""+mode+"\" unrecognized. Assuming \"scatterplot\"")
                
            //-------------------------//
            //       scatterplot       //    
            //-------------------------//
                
            //This is the default mode  

            //plot it using circle sprites
            let geometry = new THREE.Geometry()
            let sprite = new THREE.TextureLoader().load(this.dataPointImage)
            //https://github.com/mrdoob/three.js/issues/1625
            sprite.magFilter = THREE.LinearFilter
            sprite.minFilter = THREE.LinearFilter

            for(let i = 0; i < df.length; i ++)
            {
                let vertex = new THREE.Vector3()
                vertex.x = df[i][x1col]/maxX1
                vertex.y = df[i][x2col]/maxX2
                vertex.z = df[i][x3col]/maxX3
                geometry.vertices.push(vertex)  
                geometry.colors.push(dfColors[i])
            }

            //https://github.com/mrdoob/three.js/issues/1625
            //alphaTest = 1 causes errors
            //alphaTest = 0.9 edgy picture
            //alphaTest = 0.1 black edges on the sprite
            //alphaTest = 0 not transparent infront of other sprites anymore
            //sizeAttenuation: false, sprites don't change size in distance and size is in px
            let material = new THREE.PointsMaterial({
                size: dataPointSize,
                map: sprite,
                alphaTest: 0.7,
                transparent: true,
                vertexColors: true
            })
            //material.color.set(0x2faca3)
            let particles = new THREE.Points(geometry, material)
            this.disposeMesh(this.plotmesh)
            this.plotmesh = particles
            this.scene.add(particles)
            this.benchmarkStamp("made a scatterplot")
        }
    }



    /**
     * if plotmesh is invalid it gets clered
     * @return returns true if plotmesh is still valid and existant
     */
    IsPlotmeshValid()
    {
        let invalid = (this.redraw == true || this.plotmesh == undefined || this.plotmesh.geometry == undefined)
        if(invalid)
        {
            this.disposeMesh(this.plotmesh)
            return false
        }
        return true
    }



    /**
     * frees memory and removes the plotmesh (by making it available for the garbage collegtor)
     */
    disposeMesh(mesh)
    {
        if(mesh != undefined)
        {
            if(mesh.geometry != undefined)
            {
                mesh.geometry.dispose()
                mesh.material.dispose()
            }
            
            //recursively clear the children
            for(let i = 0;i < mesh.children; i++)
                this.disposeMesh(mesh.cildren[i])

            this.scene.remove(mesh)
            mesh = undefined
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
        this.axes = this.createAxes(color)
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
     * 
     * @param {object} dimensions json object can contain the following:
     *                            - xRes number of vertices for the x-axis  
     *                            - zRes number of vertices for the z-axis
     *                            - xLen length of the x-axis. This is for the frame for data normalisation and formula plotting
     *                            - yLen length of the y-axis. This is for the frame for data normalisation and formula plotting
     *                            - zLen length of the z-axis. This is for the frame for data normalisation and formula plotting
     *                            TODO set offset of the plot
     */
    setDimensions(dimensions)
    {
        if(typeof(dimensions) != "object")
            return console.error("param of setDimensions (dimensions) should be a json object containing at least one of xRes, zRes, xLen, yLen or zLen")

        if(dimensions.xRes <= 0 || dimensions.zRes <= 0)
            return console.error("xRes and zRes have to be positive. xRes:"+dimensions.xRes+" zRes:"+dimensions.zRes)

        if(dimensions.xRes != undefined)
            this.xRes = parseInt(dimensions.xRes)
        if(dimensions.zRes != undefined)
            this.zRes = parseInt(dimensions.zRes)
        if(dimensions.xLen != undefined)
            this.xLen = dimensions.xLen
        if(dimensions.yLen != undefined)
            this.yLen = dimensions.yLen
        if(dimensions.zLen != undefined)
            this.zLen = dimensions.zLen
            
        this.xVerticesCount = this.xLen*this.xRes+1
        this.zVerticesCount = this.zLen*this.zRes+1

        //vertices counts changed, so the mesh has to be recreated
        this.redraw = true

        //takes effect once the mesh gets created from new
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
     * changes the datapoint image. You need to plot the data again after this function so that the change takes effect
     * @param {string} url url of the image.
     */
    setDataPointImage(url)
    {
        console.log("url: "+typeof(url))
        this.dataPointImage = url
    }



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
     * updates what is visible on the screen. This needs to be called after a short delay of a few ms after the plot was updated 
     * @example window.setTimeout(()=>this.render(),10) //(es6 syntax)
     */
    render()
    {
        this.renderer.render(this.scene, this.camera)
    }



    /** 
     * enables benchmarking. Results will be printed into the console.
     * To disable it, use: disableBenchmarking(). To print a timestamp to the console, use  this.benchmarkStamp("foobar")
     */
    enableBenchmarking()
    {
        this.benchmark = {}
        this.benchmark.enabled = true
        this.benchmark.recentTime = -1 //tell  this.benchmarkStamp() to write the current time into recentResult
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
        let near = 0.05 //when objects start to disappear at zoom-in
        let far = 20 //when objects start to disappear at zoom-out
        let camera = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)
        //let zoom = 1000
        //let camera = new THREE.OrthographicCamera(width/-zoom, width/zoom, height/-zoom, height/zoom, near, far)
        camera.position.set(0.5,0.6,2)
        
        let controls = new OrbitControls(camera, this.renderer.domElement)
        controls.enableKeys = true
        controls.target.set(0.5,0.5,0.5)
        controls.addEventListener("change", ()=>this.render())
        controls.enableDamping = true
        controls.dampingFactor = 0.25
        controls.enableZoom = true
        controls.rotateSpeed = 0.3
        controls.maxDistance = 5
        controls.minDistance = 0.3

        //start looking at the target initially
        camera.lookAt(controls.target)

        this.camera = camera
    }



    /**
     * takes care of creating the light 
     * @private
     */
    createLight()
    {
        // set a directional light
        let directionalLight1 = new THREE.DirectionalLight(0xff6600, 4)
        directionalLight1.position.y = 10;
        this.scene.add(directionalLight1)
        let directionalLight2 = new THREE.DirectionalLight(0x0033ff, 6)
        directionalLight2.position.y = -10;
        this.scene.add(directionalLight2)
    }

    

    /**
     * creates the axes that point into the three x, y and z directions as wireframes
     * @private
     * @param {string} color     hex string of the axes color. default black #000000
     */
    createAxes(color="0x000000")
    {
        this.disposeMesh(this.axes)

        let colorObject = this.ColorManager.getColorObjectFromAnyString(color)
        if(colorObject != undefined)
            color = colorObject

        let geom = new THREE.Geometry()

        let cent = new THREE.Vector3(0,0,0)
        let xend = new THREE.Vector3(this.xLen,0,0)
        let yend = new THREE.Vector3(0,this.yLen,0)
        let zend = new THREE.Vector3(0,0,this.zLen)

        geom.vertices.push(cent) //0
        geom.vertices.push(xend) //1
        geom.vertices.push(yend) //2
        geom.vertices.push(zend) //3
        geom.faces.push(new THREE.Face3(0,0,1))
        geom.faces.push(new THREE.Face3(0,0,2))
        geom.faces.push(new THREE.Face3(0,0,3))

        //wireframe and color those paths
        let axesMat = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            side: THREE.DoubleSide
          });

        let axes = new THREE.Mesh(geom, axesMat)
        this.scene.add(axes)

        this.axes = axes

        //a box that adds a few dashed lines to the sides for more orientation (unfinished)
        //needs to be aligned to xLen, yLen and zLen. Maybe the three planes x1*x2, x2*x3 and x1*x3 should get such dashed lines
        //not sure yet
        /*let boxgeom = new THREE.BoxGeometry(1,1,1)
        boxgeom.translate(0.5,0.5,0.5)
        let boxmat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.BackSide,
            opacity: 0.1,
            transparent: true
        })
        let box = new THREE.Mesh(boxgeom,boxmat)
        this.scene.add(box)*/
    }



    /**
     * function that is used when calculating the x3 values f(x1, x2)
     * @private
     * 
     * @param {number} x1        x1 value in the coordinate system
     * @param {number} x2        x2 value in the coordinate system
     */
    f(x1, x2)
    {
        if(x1 < 0 || x2 < 0 || x1 > this.xLen || x2 > this.zLen)
            return 0

        //checking for a point if it has been calculated already increases the performance and
        //reduces the number of recursions.
        
        let val = this.calculatedPoints[parseInt(x1*this.xRes)][parseInt(x2*this.zRes)]

        if(val == undefined) //has this point has already been calculated before?
        {
            if(!this.stopRecursion)
                //bind f it to this, so that it can access this.calculatedPoints, this.xLen and this.zLen, this.stopRecursion
                //another solution would be probably if I would just hand the variables over to MathParser
                val = this.MathParser.eval2(this.parsedFormula, x1, x2, this.f.bind(this))
            
            this.calculatedPoints[parseInt(x1*this.xRes)][parseInt(x2*this.zRes)] = val
        }

        //val might return NaN for Math.sqrt(-1)
        //that's fine. Handle this case in the loops that plot the function

        return val
    }
}