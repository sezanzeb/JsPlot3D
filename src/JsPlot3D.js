/** @module JsPlot3D */
const THREE = require("three")
const OrbitControls = require('three-orbit-controls')(THREE)
import MathParser from "./MathParser.js"



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
     * @param {string} backgroundClr background color of the plot.
     * @param {string} axesClr       color of the axes.
     */
    constructor(container, backgroundClr="#ffffff", axesClr="#000000")
    {
        if(typeof(container) != "object")
            return console.error("first param for the Plot constructor (container) should be a DOM-Object. This can be obtained using e.g. document.getElementById(\"foobar\")")
        
        //some plotdata specific variables. I want setters and getter for all those at some point
        this.MathParser = new MathParser()
        this.resetCalculation() //configures the variables
        this.dataPointImage = "datapoint.png"

        //check if dataPointImage is available
        let img = new Image()
        img.onerror = ()=>console.warn(this.dataPointImage+" does not exist. Scatterplots will not be visible")

        img.src = this.dataPointImage

        //three.js setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setClearColor(backgroundClr)
        this.setContainer(container)

        this.scene = new THREE.Scene()
        
        //config
        //boundaries and dimensions of the plot data
        this.setDimensions({xLen:1,yLen:1,zLen:1,xRes:20,zRes:20})

        this.createLight()
        this.createAxes(axesClr)
        this.createArcCamera()
        this.render()

        //this.enableBenchmarking()
    }
    


    /**
     * plots a formula into the container
     * 
     * @param {string}  originalFormula string of formula
     * @param {boolean} scatterplot     - true if this function should plot values as datapoints into the 3D space
     *                                  - false if it should be a connected mesh (default)
     */
    plotFormula(originalFormula, scatterplot=false)
    {       
        if(typeof(originalFormula) != "string")
            return console.error("first param of plotFormula (originalFormula) should be string")
        if(typeof(scatterplot) != "boolean")
            return console.error("first param of plotFormula (scatterplot) should be boolean")

        this.resetCalculation()
        this.parsedFormula = this.MathParser.parse(originalFormula)
        
        if(!scatterplot) //3D-Plane
        {
            //might need to recreate the geometry and the matieral
            //is there a plotmesh already? Or maybe a plotmesh that is not created from a 3D Plane (could be a scatterplot or something else)
            if(this.plotmesh == undefined || this.plotmesh.geometry == undefined || this.plotmesh.geometry.type != "PlaneGeometry")
            {
                if(this.plotmesh != undefined)
                    this.scene.remove(this.plotmesh)

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
    
            window.setTimeout(()=>this.render(),10)
        }
        else
        {
            //Scatterplot

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
                    df[i] = [x/this.xRes,y,z/this.zRes] //store the datapoint
                    i++
                }
            }
            let options = {
                scatterplot: true,
                colorCol: 1
            }

            //continue plotting this DataFrame
            plot.plotDataFrame(df, 0, 1, 2, options)

        }
    }
    
    
    
    /**
     * plots a .csv string into the container
     *
     * @param {string}  sCsv        string of the .csv file, e.g."a;b;c\n1;2;3\n2;3;4"
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param {number}  x2col       column index used for transforming the x2 axis (z). default: -1 (use index)
     * @param {number}  x3col       column index used for plotting the x3 axis (y)
     * @param {object}  options     json object with one or more of the following parameters:
     * - separator {string}: separator used in the .csv file. e.g.: "," or ";" as in 1,2,3 or 1;2;3
     * - header {boolean}: a boolean value whether or not there are headers in the first row of the csv file. Default true
     * - colorCol {number}: leave undefined or set to -1, if defaultColor should be applied. Otherwise the index of the csv column that contains color information. 
     *                      (0, 1, 2 etc.). Formats of the column within the .csv file allowed:
     *                      numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically.
     *                      Integers that are used as class for labeled data would result in various different hues in the same way.
     *                      hex strings ("#f8e2b9"). "rgb(...)" strings. "hsl(...)" strings. strings as labels (make sure to set labeled = true).
     * - scatterplot {boolean}: (not yet working) true if the datapoints should be dots inside the 3D space (Default). false if it should be a connected mesh
     * - normalize {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - labeled {boolean}: true if colorCol contains labels (such as 0, 1, 2 or frog, cat, dog). This changes the way it is colored.
     *                      Having it false on string-labeled data will throw a warning, but it will continue as it was true
     * - defaultColor {number or string}: examples: #1a3b5c, 0xfe629a, rgb(0.1,0.2,0.3), hsl(0.4,0.5,0.6). Gets applied when either colorCol is -1, undefined or ""
     */
    plotCsvString(sCsv, x1col, x2col, x3col, options)
    {
        //---------------------------//
        //  parameter type checking  //    
        //---------------------------//
        //default config
        let separator=","
        let header=false
        let colorCol=-1
        let scatterplot=true
        let normalize=true
        let title=""
        let fraction=1
        let labeled=false

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
            if(options.colorCol == "")
                options.colorCol = undefined
            if(options.separator == "")
                options.separator = undefined

            //check numbers. Overwrite if it's good. If not, default value will remain
            if(checkNumber("fraction",options.fraction))
                fraction = parseFloat(options.fraction)
            if(checkNumber("colorCol",options.colorCol))
                colorCol = parseInt(options.colorCol)
            if(checkNumber("x1col",x1col))
                x1col = parseFloat(x1col)
            if(checkNumber("x2col",x2col))
                x2col = parseFloat(x2col)
            if(checkNumber("x3col",x3col))
                x3col = parseFloat(x3col)

            //check booleans. Overwrite if it's good. If not, default value will remain
            if(checkBoolean("labeled",options.labeled))
                labeled = options.labeled
            if(checkBoolean("normalize",options.normalize))
                normalize = options.normalize
            if(checkBoolean("header",options.header))
                header = options.header
            if(checkBoolean("scatterplot",options.scatterplot))
                scatterplot = options.scatterplot

            //check everything else
            if(options.separator != undefined)
                separator = options.separator
            if(options.title != undefined)
                title = options.title
            if(options.defaultcolor != undefined)
                defaultcolor = options.defaultcolor
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
            data = data.slice(data.length-data.length*fraction)
            let headerRow = ""

            //find out the separator automatically if the user didn't define it
            if(options.separator == undefined)
            {
                if(data[0].indexOf(separator) == -1)
                    separator = ";" //try a different one
                    
                if(data[0].indexOf(separator) == -1)
                    return console.error("no csv separator/delimiter was detected. Please set separator=\"...\" according to your file format: \""+data[0]+"\"")
            }
            else
            {
                if(data[0].indexOf(separator) == -1)
                    return console.error("haven't found any occurence of the separator '"+separator+"' in the csv format (\""+data[0]+"\")")
            }

            if(options["header"] == undefined)
            {
                //find out automatically if they are headers or not
                //take x1col, check first line type (string/NaN?) then second line type (number/!NaN?)
                //if both are yes, it's probably header = true
                if(isNaN(data[0].split(separator)[x1col]) && !isNaN(data[1].split(separator)[x1col]))
                {
                    console.log("detected headers, going to remove them. To prevent this, set header=false")
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
            plot.plotDataFrame(data, x1col, x2col, x3col, options)
        }
        else
        {
            console.log("using cached dataframe")
            //cached
            //this.dfCache != undefined and checkstring is the same
            //same data. Fraction is now 1, because the fraction has already been taken into account
            plot.plotDataFrame(this.dfCache.dataframe, x1col, x2col, x3col, options)
        }
    }
    

    
    /**
     * plots a dataframe on the canvas element which was defined in the constructor of Plot()
     *
     * @param {number[][]}  df      int[][] of datapoints. [row][column]
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param {number}  x2col       column index used for transforming the x2 axis (z). default: -1 (use index)
     * @param {number}  x3col       column index used for plotting the x3 axis (y)
     * @param {object}  options     json object with one or more of the following parameters:
     * - header {boolean}: a boolean value whether or not there are headers in the first row of the csv file. Default true
     * - colorCol {number}: leave undefined or set to -1, if defaultColor should be applied. Otherwise the index of the csv column that contains color information. 
     *                      (0, 1, 2 etc.). Formats of the column within the .csv file allowed:
     *                      numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically.
     *                      Integers that are used as class for labeled data would result in various different hues in the same way.
     *                      hex strings ("#f8e2b9"). "rgb(...)" strings. "hsl(...)" strings. strings as labels (make sure to set labeled = true).
     * - scatterplot {boolean}: (not yet working) true if the datapoints should be dots inside the 3D space (Default). false if it should be a connected mesh
     * - normalize {boolean}: if false, data will not be normalized. Datapoints with high values will be very far away then
     * - title {string}: title of the data
     * - fraction {number}: between 0 and 1, how much of the dataset should be plotted.
     * - labeled {boolean}: true if colorCol contains labels (such as 0, 1, 2 or frog, cat, dog). This changes the way it is colored.
     *                      Having it false on string-labeled data will throw a warning, but it will continue as it was true
     * - defaultColor {number or string}: examples: #1a3b5c, 0xfe629a, rgb(0.1,0.2,0.3), hsl(0.4,0.5,0.6). Gets applied when either colorCol is -1, undefined or ""
     */
    plotDataFrame(df, x1col, x2col, x3col, options)
    {
        //---------------------------//
        //  parameter type checking  //    
        //---------------------------//
        //default config
        let header=false
        let colorCol=-1
        let scatterplot=true
        let normalize=true
        let title=""
        let fraction=1
        let labeled=false

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
            if(options.colorCol == "")
                options.colorCol = undefined

            //check numbers. Overwrite if it's good. If not, default value will remain
            if(checkNumber("fraction",options.fraction))
                fraction = parseFloat(options.fraction)
            if(checkNumber("colorCol",options.colorCol))
                colorCol = parseInt(options.colorCol)
            if(checkNumber("x1col",x1col))
                x1col = parseFloat(x1col)
            if(checkNumber("x2col",x2col))
                x2col = parseFloat(x2col)
            if(checkNumber("x3col",x3col))
                x3col = parseFloat(x3col)

            //check booleans. Overwrite if it's good. If not, default value will remain
            if(checkBoolean("labeled",options.labeled))
                labeled = options.labeled
            if(checkBoolean("normalize",options.normalize))
                normalize = options.normalize
            if(checkBoolean("header",options.header))
                header = options.header
            if(checkBoolean("scatterplot",options.scatterplot))
                scatterplot = options.scatterplot

            //check everything else
            if(options.title != undefined)
                title = options.title
            if(options.defaultcolor != undefined)
                defaultcolor = options.defaultcolor
        }


        //remove the old mesh
        this.resetCalculation()
        if(this.plotmesh != undefined)
        {
            this.scene.remove(this.plotmesh)
            this.plotmesh = undefined
        }


        //-------------------------//
        //     coloring labels     //    
        //-------------------------//
        //creates an array "dfColors" that holds the color information
        //(unnormalized numbers or color strings (#fff,rgb,hsl)) for each vertex (by index)


        let numberOfLabels = 0
        //let numberOfLabels = df.length
        //the color gets divided by (1-1/numberOfLabels) so that red does not appear twice.
        //e.g. 3 labels would be red, turqoise, red. if numberOfLabels would get initialized with 0, that formula would diverge to -inf
        //1 would make that term zero, so that the color would diverge to inf. a high number converges that term to 1, so the color won't be touched

        //take care that all the labels are numbers
        let map = {}
        let dfColors = new Array(df.length) //array of numbers that contain the individual color information of the datapoint as a number (which is going to be normalized later)
        let filterColor = true //add some filters (upper and lower color boundaries for heatmaps, normalization). Turn off if strings are in dfColors

        //also normalize the colors so that I can do hsl(clr/clrMax,100%,100%)
        //no need to check if it's numbers or not, because dfColors carries only numbers
        //Assume the first value. No worries about wether or not those are actually numbers, because if not the script below will take care
        let clrMax
        let clrMin
        let findHighestAndLowest = (value) =>
        {
            if(filterColor && colorCol != -1)
            {
                if(value > clrMax)
                    clrMax = value
                if(value < clrMin)
                    clrMin = value
            }
        }

        //now take care about if the user says it's labeled or not, if it's numbers, hex, rgb, hsl or strings
        //store it inside dfColors[i] if it (can be converted to a number)||(is already a number)

        //parameter. Does the dataset hold classes/labels?
        if(colorCol != -1) //does the user even want colors?
        {
            if(labeled) //get 0.6315 from 2.6351 or 0 from 2. this way check if there are comma values
            {
                if(df[0][colorCol].indexOf("rgb") == 0 ||
                   df[0][colorCol].indexOf("hsl") == 0 ||
                  (df[0][colorCol].indexOf("#")   == 0 && df[0][colorCol].length == 7))
                {
                    console.warn(df[0][colorCol]+" might be a color. \"labeled\" is set true. For the stored colors to show up, try \"labeled=false\"")
                }
                clrMax = 0 //assume 0
                clrMin = 0 //assume 0
                //count to ammount of labels here
                let label = ""
                for(let i = 0; i < df.length; i++)
                {
                    label = df[i][colorCol] //read the label/classification
                    if(map[label] == undefined) //is this label still unknown?
                    {
                        map[label] = numberOfLabels //map it to a unique number
                        numberOfLabels ++ //make sure the next label gets a different number
                    }
                    //copy the labels to dfColors
                    dfColors[i] = parseFloat(map[label])
                    findHighestAndLowest(dfColors[i]) //update clrMin and clrMax
                }
            }
            else
            {
                //if it is a string value, try to recognize #, rgb and hex
                if(isNaN(parseInt(df[0][colorCol])))
                {
                    filterColor = false //don't apply normalization and heatmapfilters to it

                    //try to extract color information from the string
                    if(df[0][colorCol].toLowerCase().indexOf("rgb") == 0)
                    {
                        for(let i = 0; i < df.length; i++)
                        {
                            //remove "rgb", brackets and split it into an array of [r,g,b]
                            let rgb = df[i][colorCol].substring(4,df[i][colorCol].length-1).split(",")
                            dfColors[i] = new THREE.Color(0).setRGB(rgb[0],rgb[1],rgb[2])
                        }
                    }
                    else if(df[0][colorCol].toLowerCase().indexOf("#") == 0)
                    {
                        //hex strings are supported by three.js right away
                        for(let i = 0; i < df.length; i++)
                            dfColors[i] = df[i][colorCol]
                    }
                    else if(df[0][colorCol].toLowerCase().indexOf("hsl") == 0) 
                    {
                        for(let i = 0; i < df.length; i++)
                        {
                            //remove "hsl", brackets and split it into an array of [r,g,b]
                            let hsl = df[i][colorCol].substring(4,df[i][colorCol].length-1).split(",")
                            dfColors[i] = new THREE.Color(0).setHSL(hsl[0],hsl[1],hsl[2])
                        }
                    }
                    else
                    {
                        //nothing worked, print a warning and color it all the same way
                        for(let i = 0; i < df.length; i++)
                            dfColors[i] = new THREE.Color(0).setHSL(0.2,0.95,0.55)

                        console.warn("the column that is supposed to hold the color information (index "+colorCol+") contained an unrecognized "+
                            "string (\""+df[0][colorCol]+"\"). \"labeled\" is set to "+labeled+", \"header\" is set to "+header+" (might be false "+
                            "because plotCsvString() already removed the headers). Possible formats for this column are numbers, hex values "+
                            "\"#123abc\", rgb values \"rgb(r,g,b)\", hsl values \"hsl(h,s,l)\". Now assuming labeled = true and restarting.")

                        //restart
                        labeled = true
                        options.labeled = labeled
                        this.plotDataFrame(df, x1col, x2col, x3col, options)
                        return 
                    }
                }
                else
                {
                    //it's a number. just copy it over and filter it to a heatmap
                    clrMax = df[0][colorCol] //assume the first value
                    clrMin = df[0][colorCol] //assume the first value
                    for(let i = 0; i < df.length; i++)
                    {
                        dfColors[i] = parseFloat(df[i][colorCol])
                        findHighestAndLowest(dfColors[i]) //update clrMin and clrMax
                    }
                }
            }

            //now apply the filters and create a THREE color from the information stored in dfColors
            for(let i = 0;i < df.length; i++)
            {
                let color = dfColors[i]
                //set color boundaries so that the colors are heatmap like
                let upperColorBoundary = 0 //equals red //what the highest value will get
                let lowerColorBoundary = 0.7 //equals blue //what the lowest value will get

                //manipulate the color
                if(!filterColor) //if filtering is allowed (not the case for rgb, hsl and #hex values)
                {
                    //if no filtering is allowed, just go ahead and store that color
                    dfColors[i] = new THREE.Color(color)
                }
                else
                {
                    //assume the hue is stored in dfColors
                    color = parseFloat(color)
                    color = (color-clrMin)/(clrMax-clrMin) //normalize
                    if(labeled)
                    {
                        //labeled data (each class gets a different color)
                        //prevent two labels being both red (0 and 1 as hue)
                        color = color*(1-1/numberOfLabels)
                        color = (color-0.06)%1 //shift the hue for more interesting colors
                    }
                    else
                    {
                        //heatmap
                        //make sure all the colors are within the defined range
                        color = color * (1 - lowerColorBoundary - (1-upperColorBoundary)) + lowerColorBoundary
                    }
                    
                    //store that color
                    dfColors[i] = new THREE.Color(0).setHSL(color,0.95,0.55)
                }
            }
        }
        else
        {
            //colorCol is -1
            for(let i = 0; i < df.length; i++)
                dfColors[i] = new THREE.Color(0)
        }




        //-------------------------//
        //       normalizing       //    
        //-------------------------//
        //finds out by how much the values (as well as colors) to divide and for the colors also a displacement


        //max in terms of "how far away is the farthest away point"
        let x1maxDf = 1
        let x2maxDf = 1
        let x3maxDf = 1

        //normalize, so that the farthest away point is still within the xLen yLen zLen frame
        //TODO logarithmic normalizing
        if(normalize)
        {
            //not only normalize y, but also x and z. That means all datapoints values need to get into that xLen * zLen * yLen cube
            //determine max for y-normalisation
            for(let i = 0; i < df.length; i++)
            {
                //max in terms of "how far away is the farthest away point"
                //in the df are only strings. Math.abs not only makes it positive, it also parses that string to a number
                if(Math.abs(df[i][x1col]) > x1maxDf)
                    x1maxDf = Math.abs(df[i][x1col])

                if(Math.abs(df[i][x2col]) > x2maxDf)
                    x2maxDf = Math.abs(df[i][x2col])

                if(Math.abs(df[i][x3col]) > x3maxDf)
                    x3maxDf = Math.abs(df[i][x3col])
            }
        }

        this.benchmarkStamp("normalized the data")

        
        if(scatterplot)
        {
            //-------------------------//
            //       scatterplot       //    
            //-------------------------//


            //plot it using circle sprites
            let geometry = new THREE.Geometry()
            let sprite = new THREE.TextureLoader().load(this.dataPointImage)
            //https://github.com/mrdoob/three.js/issues/1625
            sprite.magFilter = THREE.LinearFilter
            sprite.minFilter = THREE.LinearFilter

            for(let i = 0; i < df.length; i ++)
            {
                let vertex = new THREE.Vector3()
                vertex.x = df[i][x1col]/x1maxDf
                vertex.y = df[i][x2col]/x2maxDf
                vertex.z = df[i][x3col]/x3maxDf
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
                size: 0.02,
                map: sprite,
                alphaTest: 0.7,
                transparent: true,
                vertexColors: true
            })
            //material.color.set(0x2faca3)
            let particles = new THREE.Points(geometry, material)
            this.plotmesh = particles
            this.scene.add(particles)
            this.benchmarkStamp("made a scatterplot")
        }
        else
        {
            //-------------------------//
            //       3D-Mesh Plot      //    
            //-------------------------//


            //might need to recreate the geometry and the matieral
            //is there a plotmesh already? Or maybe a plotmesh that is not created from a 3D Plane (could be a scatterplot or something else)
            if(this.plotmesh == undefined || this.plotmesh.geometry == undefined || this.plotmesh.geometry.type != "PlaneGeometry")
            {
                if(this.plotmesh != undefined)
                    this.scene.remove(this.plotmesh)

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
                    y = df[i][x2col]/x2maxDf
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
    
            window.setTimeout(()=>this.render(),10)
            console.log("not yet implemented")
        }

        //TODO is there s smarter way to do it?
        window.setTimeout(()=>this.render(),10)
    }


    
    /**
     * Creates new axes with the defined color
     * @param {String} color     hex string of the axes color
     */
    setAxesColor(color="#000000") {
        if(this.axes != undefined)
            this.scene.remove(this.axes)
        this.axes = this.createAxes(color)
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

        if(dimensions.xRes != undefined)
            this.xRes = dimensions.xRes
        if(dimensions.zRes != undefined)
            this.zRes = dimensions.zRes
        if(dimensions.xLen != undefined)
            this.xLen = dimensions.xLen
        if(dimensions.yLen != undefined)
            this.yLen = dimensions.yLen
        if(dimensions.zLen != undefined)
            this.zLen = dimensions.zLen
            
        this.xVerticesCount = this.xLen*this.xRes+1
        this.zVerticesCount = this.zLen*this.zRes+1

        //vertices counts changed, so the mesh has to be recreated
        this.scene.remove(this.plotmesh)
        this.plotmesh = false //trigger recreation next time .Plot...() gets called
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
        let near = 0.1 //when objects start to disappear at zoom-in
        let far = 10 //when objects start to disappear at zoom-out
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
     * @param {string} color     hex string of the axes color
     */
    createAxes(color="#000000")
    {
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
        //TODO is there s smarter way to do it? Without Timeout it won't render
        window.setTimeout(()=>this.render(),10)
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
        //reduces the number of recursions. It will reduce the precision though

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