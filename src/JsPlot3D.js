const BABYLON = require("babylonjs")
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
    constructor(canvas, backgroundClr="#ffffff", axesClr="#000000")
    {
        //config
        //boundaries of the plot data
        this.xLen = 1
        this.yLen = 1
        this.zLen = 1
        this.res = 40 //this.resolution of the mesh
        
        //some plotdata specific variables
        this.dataframe
        this.formula
        this.stopRecursion
        this.calculatedPoints
        this.resetCalculation() //configures the variables

        //3d objects
        this.plotmesh

        //babylon3d setup
        this.canvas = canvas
        let engine = new BABYLON.Engine(canvas,true)
        this.scene = new BABYLON.Scene(engine)
        //0.2,0.25,0.3
        this.scene.clearColor = new BABYLON.Color3.FromHexString(backgroundClr)
        this.createAxes(axesClr)
        this.createLight()
        this.createArcCamera(
            new BABYLON.Vector3(this.xLen/2,this.yLen/2,this.zLen/2),
            BABYLON.Tools.ToRadians(45),
            BABYLON.Tools.ToRadians(70),
            this.xLen+this.yLen+this.zLen)
        engine.runRenderLoop(()=>this.scene.render())
    }



    /**
     * reinitializes the variables that are needed for calculating plots, so that a new plot can be started
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

            //this creates a path for CreateRibbon. Vertices y/x3 value is going to be calculated according to the formula
            //it's basically a subdivided plane
            let path = new Array(this.xLen)
            for(let i = 0; i <= this.xLen*this.res; i++)
            {
                path[i] = new Array(this.zLen)
                for(let j = 0; j <= this.zLen*this.res; j++)
                {
                    x = i/this.res
                    z = j/this.res
                    y = this.f(x,z)
                    path[i][j] = new BABYLON.Vector3(x,y,z)
                    path[i][j] = new BABYLON.Vector3(x,y,z)
                }
            }

            //creates faces between paths 0 and 1, 1 and 2, 2 and 3, etc...
            this.plotmesh = BABYLON.Mesh.CreateRibbon("Plot", path, false, false, null, this.scene)
            let material = new BABYLON.StandardMaterial("material1", this.scene)
            material.emissiveColor = new BABYLON.Color3(0.2,0.5,0)
            material.diffuseColor = new BABYLON.Color3(1,0,0)
            material.backFaceCulling = false
            this.plotmesh.material = material
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
    
            let path = new Array(this.xLen*this.res)
            for(let i = 0; i < this.xLen*this.res; i++)
            {
                path[i] = new Array(this.zLen*this.res)
                for(let j = 0; j < this.zLen*this.res; j++)
                {
                    x = i/this.res
                    z = j/this.res
                    //y = df[i][x3col]
                    y = plotMeshRawData[i][j]
                    //not every point might be defined inside the dataframe
                    if(y == undefined)
                        y = 0
                    path[i][j] = new BABYLON.Vector3(x,y,z)
                    path[i][j] = new BABYLON.Vector3(x,y,z)
                }
            }

            //creates faces between paths 0 and 1, 1 and 2, 2 and 3, etc...
            this.plotmesh = BABYLON.Mesh.CreateRibbon("Plot", path, false, false, null, this.scene)
            let material = new BABYLON.StandardMaterial("material1", this.scene)
            material.emissiveColor = new BABYLON.Color3(0.2,0.5,0)
            material.diffuseColor = new BABYLON.Color3(1,0,0)
            material.backFaceCulling = false
            this.plotmesh.material = material
        }
        else
        {
            //ParticleSystem is a group of Disc Meshes
            let SPS = new BABYLON.SolidParticleSystem("SPS", this.scene)
            //this is how a single datapoint looks.
            let datapoint = BABYLON.MeshBuilder.CreateDisc("dataPoint"+i,{radius:0.01,tessellation:10}, this.scene)
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
                particle.position = new BABYLON.Vector3(dpx1,dpx2,dpx3)
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


            let material = new BABYLON.StandardMaterial("material1", this.scene)
            material.emissiveColor = new BABYLON.Color3(0,0.8,0.5)
            material.diffuseColor = new BABYLON.Color3(0,0,0)
            material.backFaceCulling = true
            this.plotmesh.material = material
        }
    }



    /**
     * Creates an ArcCamera
     *
     * @param target    Vector3 to look at
     * @param xAngle    Radians of xAngle
     * @param yAngle    Radians of yAngle
     * @param distance  Distance of the camera to target
     */
    createArcCamera(target,xAngle,yAngle,distance)
    {
        let camera = new BABYLON.ArcRotateCamera("arcCam",
            xAngle, yAngle, distance, BABYLON.Vector3.Zero(), this.scene)
        camera.setTarget(target)

        //controls
        camera.attachControl(this.canvas,true)
        camera.keysUp.push(87)
        camera.keysDown.push(83)
        camera.keysLeft.push(65)
        camera.keysRight.push(68)

        camera.lowerRadiusLimit = distance/2
        camera.upperRadiusLimit = distance

        camera.wheelPrecision = 100
    }



    /**
     * takes care of creating the light
     */
    createLight()
    {
        let light = new BABYLON.PointLight("light1", new BABYLON.Vector3(0, 10, 0), this.scene)
        light.specular = new BABYLON.Color3(0,0,0)
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
        //recreate
        if(this.xAxis != undefined) {
            this.xAxis.dispose()
            this.yAxis.dispose()
            this.zAxis.dispose()
        }

        //create paths for the edges of the axis
        let xPath = new Array(2)
        let yPath = new Array(2)
        let zPath = new Array(2)

        //in createribbon, the path xPath[0] would connect to xPath[1]
        //this happens to be able to create faces
        //I only need edges, so only two vertices defined as the path in xPath[0]

        xPath = new Array(1)
        xPath[0] = new Array(2)
        xPath[0][0] = new BABYLON.Vector3(0,0,0)
        xPath[0][1] = new BABYLON.Vector3(this.xLen,0,0)

        yPath = new Array(1)
        yPath[0] = new Array(2)
        yPath[0][0] = new BABYLON.Vector3(0,0,0)
        yPath[0][1] = new BABYLON.Vector3(0,this.yLen,0)

        zPath = new Array(1)
        zPath[0] = new Array(2)
        zPath[0][0] = new BABYLON.Vector3(0,0,0)
        zPath[0][1] = new BABYLON.Vector3(0,0,this.zLen)

        this.xAxis = BABYLON.Mesh.CreateRibbon("xAxis", xPath, this.scene)
        this.yAxis = BABYLON.Mesh.CreateRibbon("yAxis", yPath, this.scene)
        this.zAxis = BABYLON.Mesh.CreateRibbon("zAxis", zPath, this.scene)

        //wireframe and color those paths
        let axesMat = new BABYLON.StandardMaterial("material2", this.scene)
        axesMat.wireframe = true
        axesMat.emissiveColor = new BABYLON.Color3.FromHexString(color)
        this.xAxis.material = axesMat
        this.yAxis.material = axesMat
        this.zAxis.material = axesMat
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