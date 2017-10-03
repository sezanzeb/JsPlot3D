const BABYLON = require("babylonjs")
import * as MathParser from './MathParser.js'
import * as FileParser from './FileParser.js'

//window.addEventListener("DOMContentLoaded", ()=>main())

export class Plot
{

    constructor(canvas)
    {
        //config
        //boundaries of the plot data
        this.xLen = 1
        this.yLen = 1
        this.zLen = 1
        this.res = 40 //this.resolution of the mesh
        
        //some calculation specific variables
        this.formula = ""
        this.stopRecursion = false
        this.calculatedPoints = null

        //3d
        this.plotmesh

        let engine = new BABYLON.Engine(canvas,true)
        this.scene = new BABYLON.Scene(engine)
        this.scene.clearColor = new BABYLON.Color3(0.2,0.25,0.3)

        this.resetCalculation()

        this.createAxes()
        this.createPlotMesh()
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
        this.createPlotMesh()
    }
    
    
    
    /**
     * plots a .csv file
     *
     * @param s     string of the .csv file
     */
    plotCsv(s)
    {
        console.log(s)
    }



    /**
     * entrypoint for creating the babylon.js 3D space
     */
    show()
    {
        //event listeners for when data should be plotted
        document.getElementById("formulaForm").addEventListener("submit",(e)=>this.formulaSubmit(e))
        document.getElementById("fileup").addEventListener("change",(e)=>this.fileUploaded(e))

        let canvas = document.getElementById("babyloncanvas")

    }



    /**
     * creates the 3D-plot
     * 
     * @param data      array of [[x1,x2,x3],..] values
     */
    createPlotMesh(data)
    {
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
        camera.attachControl(this.getCanvas(),true)
        camera.keysUp.push(87)
        camera.keysDown.push(83)
        camera.keysLeft.push(65)
        camera.keysRight.push(68)

        camera.lowerRadiusLimit = distance/2
        camera.upperRadiusLimit = distance

        camera.wheelPrecision = 100
    }



    /**
     * @return canvas dom element used for plotting
     */
    getCanvas()
    {
        return document.getElementById("babyloncanvas")
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
     */
    createAxes()
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
        axesMat.emissiveColor = new BABYLON.Color3(1,1,1)

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