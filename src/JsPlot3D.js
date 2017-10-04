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
     * plots a formula
     * 
     * @param s       string of formula
     */
    plotFormula(s)
    {
        if(s == undefined)
            throw("formula is missing in the parameter of plotFormula. Example: plotFormula(\"sin(x1)\")")
        this.resetCalculation()
            this.formula = MathParser.parse(s)


        if(this.plotmesh != undefined)
        this.plotmesh.dispose()

        //create a subdivided plane
        let y = 0
        let x = 0
        let z = 0

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
    
    
    
    /**
     * plots a .csv file
     *
     * @param sCsv      string of the .csv file, e.g. "a;b;c\n1;2;3\n2;3;4"
     * @param x3col     column index used for plotting the x3 axis (y)
     * @param header    a boolean value whether or not there are headers in the first row. default: false
     * @param x1col     column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param x2col     column index used for transforming the x2 axis (z). default: -1 (use index)
     */
    plotCsvString(sCsv,x3col,header = false,x1col = -1,x2col = -1)
    {
        //transform the sCsv string to a dataframe
        let data = sCsv.split("\n")

        let i = 0
        if(header)
            i = 1 //start at line index 1 to skip the header

        for(;i < data.length; i ++)
            data[i-1] = data[i].split(";")

        if(header)
            data.pop() //because there will be one undefined value in the array

        //plot the dataframe
        plot.plotDataFrame(data,x3col,x1col,x2col)
    }
    
    
    
    /**
     * plots a dataframe
     *
     * @param df        int[][] of datapoints. [column][row]
     * @param x3col     column index used for plotting the x3 axis (y)
     * @param x1col     column index used for transforming the x1 axis (x). default: -1 (use index)
     * @param x2col     column index used for transforming the x2 axis (z). default: -1 (use index)
     */
    plotDataFrame(df,x3col,x1col = -1,x2col = -1)
    {
        //TODO check if cols are available in the dataframe, if not, throw errors and stop

        this.resetCalculation()
        if(this.plotmesh != undefined)
            this.plotmesh.dispose()

        //create a subdivided plane
        let y = 0
        let x = 0
        let z = 0

        /*x1col = 0
        x2col = 1
        x3col = 2*/

        //TODO from the data in the dataframe and the selected columns
        //create a 2d xLen*res zLen*res array that contains the datapoints
        //this way I can even interpolate
        //then create the path from that array

        let path = new Array(this.xLen)
        for(let i = 0; i <= this.xLen*this.res; i++)
        {
            path[i] = new Array(this.zLen)
            for(let j = 0; j <= this.zLen*this.res; j++)
            {
                x = i/this.res
                z = j/this.res
                y = df[i][x3col]
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
     * creates the axes that point into the three x, y and z directions as wireframes
     * 
     * @param color     hex string of the axes color
     */
    createAxes(color)
    {
        let min = -1, max = 1
        let rx = Math.random() * (max-min) - min
        let ry = Math.random() * (max-min) - min
        let rz = Math.random() * (max-min) - min

        let xPath = new Array(2)
        let yPath = new Array(2)
        let zPath = new Array(2)

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

        let xAxis = BABYLON.Mesh.CreateRibbon("xAxis", xPath, this.scene)
        let yAxis = BABYLON.Mesh.CreateRibbon("yAxis", yPath, this.scene)
        let zAxis = BABYLON.Mesh.CreateRibbon("zAxis", zPath, this.scene)

        let axesMat = new BABYLON.StandardMaterial("material2", this.scene)
        axesMat.wireframe = true
        axesMat.emissiveColor = new BABYLON.Color3.FromHexString(color)

        xAxis.material = axesMat
        yAxis.material = axesMat
        zAxis.material = axesMat
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
            //the browser will throw an error in case of too much recursion
            //plot what has been calculated so far nevertheless by returning 0 in that case
            //instead of another recursive call
            if(!this.stopRecursion)
                try {
                    eval(this.formula)
                }
                catch (error) {
                    this.stopRecursion = true
                    console.log("stopping recursion/calculation because of error:")
                    console.log(error)
                }

            //trycatch was successful, therefore calculate it for real
            if(!this.stopRecursion)
                val = eval(this.formula)

            //still undefined?
            if(val == undefined)
                val = 0
            
            this.calculatedPoints[parseInt(x1*this.res)][parseInt(x2*this.res)] = val
        }

        return val
    }
    
}