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

        //three.js setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setClearColor(backgroundClr)
        this.setContainer(container)

        this.scene = new THREE.Scene()
        
        //config
        //boundaries and dimensions of the plot data
        this.setDimensions({xLen:1,yLen:1,zLen:1,xRes:40,zRes:40})

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
        


        if(!scatterplot)
        {
            //might need to recreate the geometry and the matieral
            if(this.plotmesh == undefined || this.plotmesh.geometry.type != "PlaneGeometry")
            {
                if(this.plotmesh != undefined)
                this.scene.remove(this.plotmesh)

                //create plane, divided into segments
                let planegeometry = new THREE.PlaneGeometry(this.xLen,this.zLen,this.xRes,this.zRes)
                //move it
                planegeometry.rotateX(Math.PI/2)
                planegeometry.translate(this.xLen/2,0,this.zLen/2)

                planegeometry.computeFaceNormals()
                planegeometry.computeVertexNormals()
                planegeometry.__dirtyNormals = true

                //color the plane
                let plotmat = new THREE.MeshStandardMaterial({
                    color: 0xff3b00,
                    emissive: 0x2f7b8c,
                    roughness: 0.8,
                    //wireframe: true,
                    side: THREE.DoubleSide
                    })

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
                    vIndex ++
                }
                
            this.plotmesh.geometry.verticesNeedUpdate = true
        }
        else
        {
            //if scatterplot, create a dataframe and send it to plotDataFrame
            let df = new Array(this.xLen*this.xRes * this.zLen*this.zRes)

            let y = 0
            let x = 0
            let z = 0
            let i = 0

            for(let x = 0; x <= this.xVerticesCount; x++)
            {
                for(let z = 0; z <= this.zVerticesCount; z++)
                {
                    y = this.f(x/this.xRes,z/this.zRes)
                    df[i] = [x/this.xRes,y,z/this.zRes]
                    i++
                }
            }

            plot.plotDataFrame(df, 0, 1, 2, true, false)

        }

        //TODO is there s smarter way to do it? Without Timeout it won't render
        window.setTimeout(()=>this.render(),10)
    }
    
    
    
    /**
     * plots a .csv string into the container
     *
     * @param {string}  sCsv        string of the .csv file, e.g."a;b;c\n1;2;3\n2;3;4"
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param {number}  x2col       column index used for transforming the x2 axis (z). default: -1 (use index)
     * @param {number}  x3col       column index used for plotting the x3 axis (y)
     * @param {string}  separator   separator used in the .csv file. e.g.: "," or ";" as in 1,2,3 or 1;2;3
     * @param {boolean} header      a boolean value whether or not there are headers in the first row of the csv file.
     * @param {number} colorCol    TODO not yet implemented    
     * 
     *                              -1, if no coloration should be applied. Otherwise the index of the csv column that contains color information. (0, 1, 2 etc.)
     * 
     *                              formats of the column within the .csv file allowed:
     *                              - numbers (normalized automatically, range doesn't matter). Numbers are converted to a heatmap automatically
     *                              - Integers that are used as class for labeled data would result in various different hues in the same way
     *                              - hex strings ("#f8e2b9")
     *                              - "rgb(...)" strings
     *                              - "hsl(...)" strings
     * 
     * @param {boolean} scatterplot - true if the datapoints should be dots inside the 3D space (Default)
     *                              - false if it should be a connected mesh
     * @param {boolean} normalize   if false, data will not be normalized. Datapoints with high values will be very far away then
     * @param {string}  title       title of the data
     * @param {number}  fraction    between 0 and 1, how much of the dataset should be plotted.
     */
    plotCsvString(sCsv, x1col, x2col, x3col, separator=",", header=false, colorCol=-1, scatterplot=true, normalize=true, title="", fraction=1)
    {
        this.benchmarkStamp("start")
        //still the same data?
        //create a very quick checksum sort of string
        let stepsize = parseInt(sCsv.length/20)
        let slices = ""
        for(let i = 0;i < sCsv.length; i+=stepsize)
        {
            slices = slices + sCsv[i]
        }
        //it's very important to take the fraction parameter into account for the checksum
        //because otherwise a changed fraction parameter would not change the amount of datapoints that are plotted because
        //the checksum stays the same and the dfCache.dataframe will not update
        let checkstring = title+sCsv.length+slices+fraction

        this.benchmarkStamp("calculated checkstring")

        //now check if the checksum changed. If yes, remake the dataframe from the input
        if(this.dfCache == undefined || this.dfCache.checkstring != checkstring)
        {
            //new csv arrived:

            //transform the sCsv string to a dataframe
            let data = sCsv.split("\n")
            data = data.slice(data.length-data.length*fraction) //slice() will parseInt the parameter
            let headerRow = ""

            let i = 0
            if(header)
            {
                i = 1 //start at line index 1 to skip the header
                headerRow = data[0]
            }

            for(;i < data.length; i ++)
                data[i-1] = data[i].split(separator)

            if(header)
                data.pop() //because there will be one undefined value in the array

            //cache the dataframe. If the same dataframe is used next time, don't parse it again
            this.dfCache = {}
            this.dfCache.dataframe = data
            this.dfCache.checkstring = checkstring

            this.benchmarkStamp("created the dataframe")
            //plot the dataframe. Fraction is now 1, because the fraction has already been taken into account
            plot.plotDataFrame(data, x1col, x2col, x3col, colorCol, scatterplot, normalize, 1)
        }
        else
        {
            //cached
            //this.dfCache != undefined and checkstring is the same
            //same data. Fraction is now 1, because the fraction has already been taken into account
            plot.plotDataFrame(this.dfCache.dataframe, x1col, x2col, x3col, colorCol, scatterplot, normalize, 1)
        }
    }
    

    
    /**
     * plots a dataframe on the canvas element which was defined in the constructor of Plot()
     *
     * @param {number[][]}  df           int[][] of datapoints. [row][column]
     * @param {number}      x1col        column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param {number}      x2col        column index used for transforming the x2 axis (z). default: -1 (use index)
     * @param {number}      x3col        column index used for plotting the x3 axis (y)
     * @param {any}         colorCol     TODO see plotCsvString javadoc
     * @param {boolean}     scatterplot  true if this function should plot dots as datapoints into the 3D space. Default true
     * @param {boolean}     normalize    if false, data will not be normalized. Datapoints with high values will be very far away then
     * @param {number}      fraction     between 0 and 1, how much of the dataset should be plotted.
     */
    plotDataFrame(df, x1col, x2col, x3col, colorCol=-1, scatterplot=true, normalize=true, fraction=1)
    {
        //TODO check types of the input parameters, throw error about what was expected, but what was found
        //TODO check if cols are available in the dataframe, if not, throw errors and stop
        //TODO check type of cols (of the first row), if it contains numbers or not. throw error if something else is found. only colorCol is allowed to contain string values

        this.resetCalculation()
        if(this.plotmesh != undefined)
            this.scene.remove(this.plotmesh)

        let x1maxDf = 1
        let x2maxDf = 1
        let x3maxDf = 1
        let clrMax = 1

        //normalize, so that the farthest away point is still within the xLen yLen zLen frame
        //TODO logarithmic normalizing
        if(normalize)
        {
            //not only normalize y, but also x and z. That means all datapoints values need to get into that xLen * zLen * yLen cube
            //determine max for y-normalisation
            for(let i = 0; i < df.length; i++)
            {
                if(Math.abs(df[i][x1col]) > x1maxDf)
                    x1maxDf = Math.abs(df[i][x1col])

                if(Math.abs(df[i][x2col]) > x2maxDf)
                    x2maxDf = Math.abs(df[i][x2col])

                if(Math.abs(df[i][x3col]) > x3maxDf)
                    x3maxDf = Math.abs(df[i][x3col])
            }
            
            //also normalize the colors so that I can do hsl(clr/clrMax,100%,100%)
            if(typeof(df[0][colorCol]) == "number" && colorCol != -1)
                for(let i = 0; i < df.length; i++)
                {
                    if(Math.abs(df[i][colorCol]) > clrMax)
                    clrMax = Math.abs(df[i][colorCol])
                }
            //if typeOf typeof(df[0][colorCol]) is a string, try to use that string as the color information
        }

        this.benchmarkStamp("normalized the data")

        if(scatterplot)
        {
            //plot it using circle sprites
            let geometry = new THREE.Geometry()
            let sprite = new THREE.TextureLoader().load(this.dataPointImage)
            //https://github.com/mrdoob/three.js/issues/1625
            sprite.magFilter = THREE.LinearFilter
            sprite.minFilter = THREE.LinearFilter

            for(let  i = 0; i < df.length; i ++)
            {
                let vertex = new THREE.Vector3()
                vertex.x = df[i][x1col]/x1maxDf
                vertex.y = df[i][x2col]/x2maxDf
                vertex.z = df[i][x3col]/x3maxDf
                geometry.vertices.push(vertex)
            }

            //https://github.com/mrdoob/three.js/issues/1625
            //alphatest = 1 causes errors
            //alphatest = 0.9 edgy picture
            //alphatest = 0.1 black edges on the sprite
            //alphatest = 0 not transparent infront of other sprites anymore
            //sizeAttenuation: false, sprites don't change size in distance and size is in px
            let material = new THREE.PointsMaterial({size: 0.02, map: sprite, alphaTest: 0.7, transparent: true })
            material.color.set(0x2faca3)
            let particles = new THREE.Points(geometry, material)
            this.plotmesh = particles
            this.scene.add(particles)
            this.benchmarkStamp("made a scatterplot")
        }
        else
        {
            //plot it as a 3D-Mesh with mountains and valleys

            //create a 2d xLen*res zLen*res array that contains the datapoints
            let plotMeshRawData = new Array(this.xVerticesCount)
            for(let x = 0; x < xRes; x++)
                //this is a 2D array that has the same shape as the geometric shape of this.plotmesh basically
                plotMeshRawData[x] = new Array(this.zVerticesCount)
    
    
            //from the data in the dataframe and the selected columns
            //create a 2d xLen*res zLen*res array that contains the datapoints
            //this way I can even interpolate
            //then create the path from that array
            //take a datapoint (which consists of 3 dimensions) and plot that point into the 2D array
            for(let i = 0; i < df.length; i++)
            {
                //find out which x, y and z this datapoint has and normalize those parameters to fit into xLen and zLen
                //parseInt cuts away the comma. dividing it by the maximum will normalize it
                let dpx1 = parseInt(df[i][x1col]/x1maxDf*xRes)
                let dpx2 = parseInt(df[i][x2col]/x2maxDf*zRes)
                let dpx3 = df[i][x3col]/x3maxDf
                plotMeshRawData[dpx1][dpx2] = dpx3
                //TODO interpolate
            }
    
            for(let i = 0; i < this.xLen*this.xRes; i++)
            {
                for(let j = 0; j < this.zLen*this.zRes; j++)
                {
                    x = i/this.xRes
                    z = j/this.zRes
                    //y = df[i][x3col]
                    y = plotMeshRawData[i][j]
                    //not every point might be defined inside the dataframe
                    if(y == undefined)
                        y = 0
                    //THREETODO plot y into the plane

                }
            }
            this.benchmarkStamp("made a 3D-Mesh plot")
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
        this.plotmesh = undefined //will trigger recreation once plot gets called
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
        let directionalLight1 = new THREE.DirectionalLight(0xff6600, 5)
        directionalLight1.position.y = 30;
        this.scene.add(directionalLight1)
        let directionalLight2 = new THREE.DirectionalLight(0x0033ff, 5)
        directionalLight2.position.y = -30;
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