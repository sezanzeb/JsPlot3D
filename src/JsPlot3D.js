//three.js
const THREE = require("three")
const OrbitControls = require('three-orbit-controls')(THREE)

//own modules
import MathParser from "./MathParser.js"

export class Plot
{

    /**
     * Creates a Plot instance, so that a single canvas can be rendered. After calling this constructor, rendering can
     * be done using plotFormula(s), plotCsvString(s) or plotDataFrame(df)
     * 
     * @param {element} canvas            html canvas DOM element. e.g.: <canvas id="foobar" style="width:500px; height:500px;"></canvas>, which is then selected using
     *                          Plot(document.getElementById("foobar"))
     * @param backgroundClr     background color of the plot. Default: white
     * @param axesClr           color of the axes. Default: black
     */
    constructor(container, backgroundClr="#ffffff", axesClr="#000000")
    {
        //config
        //boundaries and dimensions of the plot data
        this.setDimensions({xLen:1,yLen:1,zLen:1,xRes:40,zRes:40})
        
        //some plotdata specific variables. I want setters and getter for all those at some point
        this.MathParser = new MathParser()
        this.resetCalculation() //configures the variables
        this.dataPointImage = "datapoint.png"

        //three.js setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setClearColor(backgroundClr)
        this.setContainer(container)
        this.container.appendChild(this.renderer.domElement)

        this.scene = new THREE.Scene()
        
        this.createAxes(axesClr)
        this.createLight()
        this.createArcCamera()
        this.render()
    }
    

    /**
     * sets the container of this plot
     * 
     * @param {object} container DOM-Element of the new container
     */
    setContainer(container)
    {
        this.container = container
        this.renderer.setSize(container.offsetWidth,container.offsetHeight)
    }
    

    /**
     * gets the DOM container of this plot
     * 
     * @return {object} the DOM-Element that contains the plot
     */
    getContainer()
    {
        return this.container
    }


    /**
     * 
     * @param {json} dimensions json object can contain the following:
     *                          - xRes number of vertices for the x-axis 
     *                          - zRes number of vertices for the z-axis
     *                          - xLen length of the x-axis (to be divided into xRes vertices)
     *                          - zLen length of the z-axis (to be divided into zRes vertices)
     *                          TODO set offset of the plot
     */
    setDimensions(dimensions)
    {
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
    }


    /**
     * returns a JSON object that contains the dimensions
     * TODO print also min and max x, y and z (offset of the plot)
     * 
     * @return {json} {xRes, yRes, zRes, xLen, zLen}
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
     * 
     * @param {string} url url of the image.
     */
    setDataPointImage(url)
    {
        this.dataPointImage = url
    }



    /**
     * updates what is visible on the screen. This needs to be called after a short delay of a few ms after the plot was updated
     */
    render()
    {
        this.renderer.render(this.scene, this.camera)
    }



    /**
     * reinitializes the variables that are needed for calculating plots, so that a new plot can be started
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
     * plots a formula on the canvas element which was defined in the constructor of Plot()
     * 
     * @param {string}  originalFormula string of formula
     * @param {boolean} scatterplot     - true if this function should plot values as datapoints into the 3D space
     *                                  - false if it should be a connected mesh (default)
     */
    plotFormula(originalFormula, scatterplot=false)
    {       
        if(this.plotmesh != undefined)
            this.scene.remove(this.plotmesh)

        this.resetCalculation()
        this.parsedFormula = this.MathParser.parse(originalFormula)

        if(!scatterplot)
        {
            if(this.plotmesh != undefined)
                this.scene.remove(this.plotmesh)


            let geom = new THREE.Geometry()

            //memorizes the indices that have been in the previous line
            let indicesMemory = new Array(this.zLen*this.zRes)
            let indicesMemoryNew = new Array(this.zLen*this.zRes)

            //hiding faces:
            //https://stackoverflow.com/questions/11025307/can-i-hide-faces-of-a-mesh-in-three-js


            //create plane, divided into segments
            let plane = new THREE.PlaneGeometry(this.xLen,this.zLen,this.xRes,this.zRes)
            //move it
            plane.rotateX(Math.PI/2)
            plane.translate(this.xLen/2,0,this.zLen/2)

            //modifying vertex positions:
            //https://github.com/mrdoob/three.js/issues/972
            let y = 0
            let vIndex = 0
            for(let z = this.zVerticesCount-1; z >= 0; z--)
                for(let x = 0; x < this.xVerticesCount; x++)
                {
                    y = this.f(x/this.xRes,z/this.xRes)
                    plane.vertices[vIndex].y = y
                    vIndex ++
                }
            plane.computeFaceNormals()
            plane.computeVertexNormals()
            plane.__dirtyNormals = true

            //color the plane
            let plotmat = new THREE.MeshBasicMaterial({
                color: 0xff6600,
                //wireframe: true,
                side: THREE.DoubleSide
                })

            //modify this.plotmesh
    
            this.plotmesh = new THREE.Mesh(plane, plotmat)
            this.scene.add(this.plotmesh)
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
     * plots a .csv file on the canvas element which was defined in the constructor of Plot()
     *
     * @param {string}  sCsv        string of the .csv file, e.g."a;b;c\n1;2;3\n2;3;4"
     * @param {number}  x1col       column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param {number}  x2col       column index used for transforming the x2 axis (z). default: -1 (use index)
     * @param {number}  x3col       column index used for plotting the x3 axis (y)
     * @param {string}  separator   separator used in the .csv file. e.g.: "," or ";" as in 1,2,3 or 1;2;3
     *                              - default: ","
     * @param {boolean} header      a boolean value whether or not there are headers in the first row of the csv file.
     *                              - default: false
     * 
     * @param {number} colorCol    TODO not yet implemented    
     * 
     *                              -1, if no coloration should be applied. Otherwise the index of the csv column that contains color information. (0, 1, 2 etc.)
     *                              - default: -1
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
     */
    plotCsvString(sCsv, x1col, x2col, x3col, separator=",", header=false, colorCol=-1, scatterplot=true, normalize=true)
    {
        
        //transform the sCsv string to a dataframe
        let data = sCsv.split("\n")

        let i = 0
        if(header)
            i = 1 //start at line index 1 to skip the header

        for(;i < data.length; i ++)
            data[i-1] = data[i].split(separator)

        if(header)
            data.pop() //because there will be one undefined value in the array

        //plot the dataframe
        plot.plotDataFrame(data, x1col, x2col, x3col, colorCol, scatterplot)
    }
    
    
    
    /**
     * plots a dataframe on the canvas element which was defined in the constructor of Plot()
     *
     * @param {number[][]}  df           int[][] of datapoints. [column][row]
     * @param {number}      x1col        column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param {number}      x2col        column index used for transforming the x2 axis (z). default: -1 (use index)
     * @param {number}      x3col        column index used for plotting the x3 axis (y)
     * @param {any}         colorCol     TODO see plotCsvString javadoc
     * @param {boolean}     scatterplot  true if this function should plot dots as datapoints into the 3D space. Default true
     * @param {boolean}     normalize    if false, data will not be normalized. Datapoints with high values will be very far away then
     */
    plotDataFrame(df, x1col, x2col, x3col, colorCol=false, scatterplot=true, normalize=true)
    {
        //TODO check if cols are available in the dataframe, if not, throw errors and stop
        //TODO check type of cols, if numbers or not

        this.resetCalculation()
        if(this.plotmesh != undefined)
            this.scene.remove(this.plotmesh)

        let x1maxDf = 1
        let x2maxDf = 1
        let x3maxDf = 1

        if(normalize)
        {
            //not only normalize y, but also x and z. That means all y values need to get into that xLen * zLen square
            //determine max for y-normalisation
            for(let i = 0; i < df.length; i++)
                if(Math.abs(df[i][x1col]) > x1maxDf)
                    x1maxDf = Math.abs(df[i][x1col])


            for(let i = 0; i < df.length; i++)
                if(Math.abs(df[i][x2col]) > x2maxDf)
                    x2maxDf = Math.abs(df[i][x2col])

            for(let i = 0; i < df.length; i++)
                if(Math.abs(df[i][x3col]) > x3maxDf)
                    x3maxDf = Math.abs(df[i][x3col])
        }

        //create a 2d xLen*res zLen*res array that contains the datapoints
        let zRes = this.zLen*this.zRes
        let xRes = this.xLen*this.xRes


        if(!scatterplot)
        {
            let plotMeshRawData = new Array(xRes)
    
            for(let x = 0; x < xRes; x++)
            {
                //this is not a 2D array that has the same shape as this.plotmesh basically
                plotMeshRawData[x] = new Array(zRes)
            }
    
    
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
        }
        else
        {
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
            material.color.setRGB(0.2,0.7,0.5)
            let particles = new THREE.Points(geometry, material)
            this.plotmesh = particles
            this.scene.add(particles)
        }

        //TODO is there s smarter way to do it?
        window.setTimeout(()=>this.render(),10)
    }



    /**
     * Creates the camera
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
     */
    createLight()
    {
        // set a directional light
        let directionalLight = new THREE.DirectionalLight(0xffffff, 5)
        directionalLight.position.z = 3;
        this.scene.add(directionalLight)
    }


    
    /**
     * Creates new axes with the defined color
     * 
     * @param {String} color     hex string of the axes color
     */
    setAxesColor(color="#000000") {
        if(this.axes != undefined)
            this.scene.remove(this.axes)
        this.axes = this.createAxes(color)
    }



    /**
     * creates the axes that point into the three x, y and z directions as wireframes
     * 
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