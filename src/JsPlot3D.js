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
        //boundaries of the plot data
        this.xLen = 1
        this.yLen = 1
        this.zLen = 1
        this.xRes = 40
        this.zRes = 40
        this.xVerticesCount = this.xLen*this.xRes+1
        this.zVerticesCount = this.zLen*this.zRes+1
        
        //some plotdata specific letiables. I want setters and getter for all those at some point
        this.dataframe
        this.formula
        this.MathParser = new MathParser()
        this.stopRecursion
        this.calculatedPoints
        this.resetCalculation() //configures the variables
        this.datapointImage = "datapoint.png"

        //3d objects
        this.plotmesh

        //three.js setup
        this.container = container
        let height = container.offsetHeight
        let width = container.offsetWidth

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(width,height)
        this.renderer.setClearColor(backgroundClr)
        container.appendChild(this.renderer.domElement)

        this.scene = new THREE.Scene()
        
        this.createAxes(axesClr)
        this.createLight()
        this.createArcCamera(width, height)

        this.render()
    }
    


    /**
     * updates what is visible on the screen. This needs to be called after a short delay of a few ms after the plot was updated
     */
    render()
    {
        this.renderer.render(this.scene, this.camera)
    }



    /**
     * reinitializes the letiables that are needed for calculating plots, so that a new plot can be started
     */
    resetCalculation()
    {
        this.calculatedPoints = new Array(this.xVerticesCount)
        for(let i = 0;i < this.calculatedPoints.length; i++)
            this.calculatedPoints[i] = new Array(this.zVerticesCount)

        this.formula = ""
        this.stopRecursion = false
    }



    /**
     * plots a formula on the canvas element which was defined in the constructor of Plot()
     * 
     * @param {string}  s           string of formula
     * @param {boolean} scatterplot - true if this function should plot values as datapoints into the 3D space
     *                              - false if it should be a connected mesh (default)
     */
    plotFormula(s, scatterplot=false)
    {
        if(s == undefined)
            throw("formula is missing in the parameter of plotFormula. Example: plotFormula(\"sin(x1)\")")
            
        if(this.plotmesh != undefined)
            this.scene.remove(this.plotmesh)

        this.resetCalculation()
        this.formula = this.MathParser.parse(s)

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
            for(let x = 0; x < this.xVerticesCount; x++)
                for(let z = 0; z < this.zVerticesCount; z++)
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

            for(let x = 0; x <= this.xLen*this.xRes; x++)
            {
                for(let z = 0; z <= this.zLen*this.zRes; z++)
                {
                    y = this.f(x/this.xRes,z/this.zRes)
                    df[i] = [x/this.xRes,y,z/this.zRes]
                    i++
                }
            }

            plot.plotDataFrame(df, 0, 1, 2, true, false)

        }

        //TODO is there s smarter way to do it?
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
     * @param {any}     colorCol    false, if no coloration should be applied. Otherwise the index of the csv column that contains color information. (0, 1, 2 etc.)
     *                              - default: false
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
    plotCsvString(sCsv, x1col, x2col, x3col, separator=",", header=false, colorCol=false, scatterplot=true, normalize=true)
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
        plot.plotDataFrame(data,x1col,x2col,x3col, colorCol, scatterplot)
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
            let sprite = new THREE.TextureLoader().load(this.datapointImage)
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
     * 
     * @param {number} width screen width
     * @param {number} height screen height
     */
    createArcCamera(width, height)
    {
        let viewAngle = 80
        let aspect = width / height
        let near = 0.1
        let far = 10
        let camera = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)
        camera.position.set(0.5,0.5,2)
        
        let controls = new OrbitControls(camera, this.renderer.domElement)
        controls.enableKeys = true
        controls.target.set(0.5,0.5,0.5)
        controls.addEventListener("change", ()=>this.render())
        controls.enableDamping = true
        controls.dampingFactor = 0.25
        controls.enableZoom = true
        controls.rotateSpeed = 0.3

        camera.lookAt(new THREE.Vector3(0.5,0.5,0.5))
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
     * Actually a synonym for createAxes(color). Creates new axes with the defined color
     * 
     * @param {String} color     hex string of the axes color
     */
    setAxesColor(color="#000000") {
        this.createAxes(color)
    }



    /**
     * creates the axes that point into the three x, y and z directions as wireframes
     * 
     * @param {string} color     hex string of the axes color
     */
    createAxes(color="#000000")
    {
        //THREETODO displose axes is they have been are already created

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
        this.scene.add(axes);
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
                val = this.MathParser.eval2(this.formula, x1, x2, this.f.bind(this))
            
            this.calculatedPoints[parseInt(x1*this.xRes)][parseInt(x2*this.zRes)] = val
        }

        if(val == undefined)
            return 0

        return val
    }
    
}