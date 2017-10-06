const THREE = require("three")
const OrbitControls = require('three-orbit-controls')(THREE)
import * as MathParser from './MathParser.js'

export class Plot
{

    /**
     * Creates a Plot instance, so that a single canvas can be rendered. After calling this constructor, rendering can
     * be done using plotFormula(s), plotCsvString(s) or plotDataFrame(df)
     * 
     * @param canvas            html canvas DOM element. e.g.: <canvas id="foobar" style="width:500px; height:500px;"></canvas>, which is then selected using
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
        this.res = 40 //this.resolution of the mesh
        
        //some plotdata specific letiables
        this.dataframe
        this.formula
        this.stopRecursion
        this.calculatedPoints
        this.resetCalculation() //configures the letiables

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

        // cube geometry (200 x 200 x 200);
        let geometry = new THREE.CubeGeometry(0.1, 0.1, 0.1)
        let material = new THREE.MeshLambertMaterial( { color: 0x660000 } )
        let cubeMesh = new THREE.Mesh( geometry, material)
        this.scene.add( cubeMesh )
        
        this.createAxes(axesClr)
        this.createLight()
        this.camera = this.createCamera(width, height)
    }


    render(gl, width, height) {
        console.log("test")
        renderer.render(this.scene, this.camera)
    }


    /**
     * reinitializes the letiables that are needed for calculating plots, so that a new plot can be started
     */
    resetCalculation()
    {
        this.calculatedPoints = new Array(this.xLen*this.res+1)
        for(let i = 0;i < this.calculatedPoints.length; i++)
            this.calculatedPoints[i] = new Array(this.zLen*this.res+1)

        this.formula = ""
        this.stopRecursion = false
    }



    /**
     * plots a formula on the canvas element which was defined in the constructor of Plot()
     * 
     * @param s       string of formula
     */
    plotFormula(s, scatterplot=false)
    {
        if(s == undefined)
            throw("formula is missing in the parameter of plotFormula. Example: plotFormula(\"sin(x1)\")")
            
        this.resetCalculation()
            this.formula = MathParser.parse(s)

        if(!scatterplot)
        {
            if(this.plotmesh != undefined)
            this.plotmesh.dispose()

            let y = 0
            let x = 0
            let z = 0

            for(let i = 0; i <= this.xLen*this.res; i++)
            {
                for(let j = 0; j <= this.zLen*this.res; j++)
                {
                    x = i/this.res
                    z = j/this.res
                    y = this.f(x,z)
                    //THREETODO plot y into the plane
                }
            }
        }
        else
        {
            //if scatterplot, create a dataframe and send it to plotDataFrame
            let df = new Array(this.xLen*this.res * this.yLen*this.res)

            let y = 0
            let x = 0
            let z = 0
            let i = 0

            for(let x = 0; x <= this.xLen*this.res; x++)
            {
                for(let z = 0; z <= this.yLen*this.res; z++)
                {
                    y = this.f(x/this.res,z/this.res)
                    df[i] = [x/this.res,y,z/this.res]
                    i++
                }
            }

            plot.plotDataFrame(df, 0, 1, 2, true, false)

        }
    }
    
    
    
    /**
     * plots a .csv file on the canvas element which was defined in the constructor of Plot()
     *
     * @param sCsv      string of the .csv file, e.g. "a;b;c\n1;2;3\n2;3;4"
     * @param separator separator used in the .csv file. e.g.: 1,2,3 or 1;2;3
     * @param x3col     column index used for plotting the x3 axis (y)
     * @param header    a boolean value whether or not there are headers in the first row. default: false
     * @param x1col     column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param x2col     column index used for transforming the x2 axis (z). default: -1 (use index)
     */
    plotCsvString(sCsv, x1col, x2col, x3col, separator=",", header=false, scatterplot=true)
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
        plot.plotDataFrame(data,x1col,x2col,x3col,scatterplot)
    }
    
    
    
    /**
     * plots a dataframe on the canvas element which was defined in the constructor of Plot()
     *
     * @param df        int[][] of datapoints. [column][row]
     * @param x3col     column index used for plotting the x3 axis (y)
     * @param x1col     column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param x2col     column index used for transforming the x2 axis (z). default: -1 (use index)
     */
    plotDataFrame(df, x1col, x2col, x3col, scatterplot=true, normalize=true)
    {
        //TODO check if cols are available in the dataframe, if not, throw errors and stop
        //TODO check type of cols, if numbers or not

        this.resetCalculation()
        if(this.plotmesh != undefined)
            this.plotmesh.dispose()


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
        let zRes = this.zLen*this.res
        let xRes = this.xLen*this.res


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
    
            for(let i = 0; i < this.xLen*this.res; i++)
            {
                for(let j = 0; j < this.zLen*this.res; j++)
                {
                    x = i/this.res
                    z = j/this.res
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
            //ParticleSystem is a group of Disc Meshes
            let SPS = new THREE.SolidParticleSystem("SPS", this.scene)
            //this is how a single datapoint looks.
            let datapoint = THREE.MeshBuilder.CreateDisc("dataPoint"+i,{radius:0.01,tessellation:10}, this.scene)
            //create as many Discs as datapoints are available
            SPS.addShape(datapoint, df.length)
            datapoint.dispose()


            //in the following function, move the particles according to the dataframe info
            let i = 0
            SPS.updateParticle = function(particle)
            {
                //find out which x, y and z this datapoint has and normalize those parameters to fit into xLen and zLen
                //parseInt cuts away the comma. dividing it by the maximum will normalize it
                let dpx1 = df[i][x1col]/x1maxDf
                let dpx2 = df[i][x2col]/x2maxDf
                let dpx3 = df[i][x3col]/x3maxDf
                particle.position = new THREE.Vector3(dpx1,dpx2,dpx3)
                i ++
            }


            //create a mesh from all the particles
            this.plotmesh = SPS.buildMesh()

            //now, call SPS.updateParticle to move them to their position
            SPS.initParticles()
            SPS.setParticles()

            //datapoint always looks towards the camera
            SPS.billboard = true
            SPS.computeParticleRotation = false
            SPS.computeParticleColor = false
            SPS.computeParticleTexture = false
            SPS.isAlwaysVisible = true

            this.scene.registerBeforeRender(function() {
                i = 0
                SPS.setParticles()
            })


            let material = new THREE.StandardMaterial("material1", this.scene)
            material.emissiveColor = new THREE.Color3(0,0.8,0.5)
            material.diffuseColor = new THREE.Color3(0,0,0)
            material.backFaceCulling = true
            this.plotmesh.material = material
        }
    }



    /**
     * Creates the camera
     */
    createCamera(width, height)
    {
        let viewAngle = 80
        let aspect = width / height
        let near = 1
        let far = 10
        let camera = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)
        camera.position.set(-2,-2,-2)
        camera.lookAt(new THREE.Vector3(0,0,0))
        
        let controls = new OrbitControls(camera, this.renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.25
        controls.enableZoom = true

        return camera
    }



    /**
     * takes care of creating the light
     */
    createLight()
    {
        // set a directional light
        let directionalLight = new THREE.DirectionalLight( 0xffffff, 5 )
        directionalLight.position.z = 3;
        this.scene.add( directionalLight )
    }


    
    /**
     * A synonym for createAxes(color). Creates new axes with the defined color
     * 
     * @param color     hex string of the axes color
     */
    setAxesColor(color="#000000") {
        this.createAxes(color)
    }



    /**
     * creates the axes that point into the three x, y and z directions as wireframes
     * 
     * @param color     hex string of the axes color
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
        geom.faces.push(new THREE.Face3(0,1,2))
        geom.faces.push(new THREE.Face3(1,2,3))

        //wireframe and color those paths
        let axesMat = new THREE.MeshBasicMaterial( {
            color: color,
            wireframe: false
          } );

        let axes = new THREE.Mesh(geom, axesMat)

        let object = new THREE.AxisHelper( 1 );
        object.position.set( 0, 0, 0 );
        this.scene.add( object );
    }



    /**
     * function that is used when calculating the x3 values f(x1, x2)
     * 
     * @param x1        x1 value in the coordinate system
     * @param x2        x2 value in the coordinate system
     */
    f(x1, x2)
    {
        if(x1 < 0 || x2 < 0 || x1 > this.xLen || x2 > this.zLen)
            return 0

        //checking for a point if it has been calculated already increases the performance and
        //reduces the number of recursions. It will reduce the precision though
        let val = this.calculatedPoints[parseInt(x1*this.res)][parseInt(x2*this.res)]

        if(val == undefined) //has this point has already been calculated before?
        {
            if(!this.stopRecursion)
                val = eval(this.formula)
            
            this.calculatedPoints[parseInt(x1*this.res)][parseInt(x2*this.res)] = val
        }

        if(val == undefined)
            return 0

        return val
    }
    
}