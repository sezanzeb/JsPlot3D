const BABYLON = require("babylonjs")
require("./process.js")
import * as Math2 from './math.js'

window.addEventListener("DOMContentLoaded", ()=>main())
document.getElementById("formulaForm").addEventListener("submit",(e)=>formulaSubmit(e))

let scene
let plotmesh

//config

//boundaries of the plot data
let xLen = 1
let yLen = 1
let zLen = 1
let res = 40 //resolution of the mesh


//some calculation specific variables
let formula
let stopRecursion
let calculatedPoints


/**
 * event listener for typed in formulas
 * 
 * @param e     event object from the listener
 */
function formulaSubmit(e)
{
    if(e != null)
        e.preventDefault() //don't reload page

    resetCalculation()

    formula = document.getElementById("formulaText").value
    
    formula = Math2.parse(formula)

    createPlotMesh()    
}



function resetCalculation()
{
    calculatedPoints = new Array(xLen*res+1)
    for(let i = 0;i < calculatedPoints.length; i++)
        calculatedPoints[i] = new Array(zLen*res+1)

    formula = ""
    stopRecursion = false
}


/**
 * entrypoint for creating the babylon.js 3D space
 */
function main()
{
    let canvas = document.getElementById("babyloncanvas")
    let engine = new BABYLON.Engine(canvas,true)
    scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color3(0.2,0.25,0.3)

    //either this or resetCalculation() needs to happen before createPlotMesh()
    formulaSubmit(null)

    createAxes()
    createPlotMesh()
    createLight()
    
    createArcCamera(
        new BABYLON.Vector3(xLen/2,yLen/2,zLen/2),
        BABYLON.Tools.ToRadians(45),
        BABYLON.Tools.ToRadians(70),
        xLen+yLen+zLen)

    engine.runRenderLoop(()=>scene.render())

}



/**
 * function that is used when calculating the x3 values f(x1, x2)
 * 
 * @param x1        x1 value in the coordinate system
 * @param x2        x2 value in the coordinate system
 */
function f(x1, x2)
{
    if(x1 < 0 || x2 < 0 || x1 > xLen || x2 > zLen)
        return 0

    //checking for a point if it has been calculated already increases the performance and
    //reduces the number of recursions
    let val = calculatedPoints[parseInt(x1*res)][parseInt(x2*res)]

    if(val == undefined) //has this point has already been calculated before?
    {
        //the browser will throw an error in case of too much recursion
        //plot what has been calculated so far nevertheless by returning 0 in that case
        //instead of another recursive call
        if(!stopRecursion)
            try {
                eval(formula)
            }
            catch (error) {
                stopRecursion = true
                console.log("stopping recursion/calculation because of error:")
                console.log(error)
            }

        //trycatch was successful, therefore calculate it for real
        if(!stopRecursion)
            val = eval(formula)

        //still undefined?
        if(val == undefined)
            val = 0
        
        calculatedPoints[parseInt(x1*res)][parseInt(x2*res)] = val
    }

    return val
}



/**
 * creates the 3D-plot
 * 
 * @param data      array of [[x1,x2,x3],..] values
 */
function createPlotMesh(data)
{
    if(plotmesh != undefined)
        plotmesh.dispose()

    //create a subdivided plane
    let y = 0
    let x = 0
    let z = 0

    let path = new Array(xLen)
    for(let i = 0; i <= xLen*res; i++)
    {
        path[i] = new Array(zLen)
        for(let j = 0; j <= zLen*res; j++)
        {
            x = i/res
            z = j/res
            y = f(x,z)
            path[i][j] = new BABYLON.Vector3(x,y,z)
            path[i][j] = new BABYLON.Vector3(x,y,z)
        }
    }


    //creates faces between paths 0 and 1, 1 and 2, 2 and 3, etc...
    plotmesh = BABYLON.Mesh.CreateRibbon("Plot", path, false, false, null, scene)
    let material = new BABYLON.StandardMaterial("material1", scene)
    material.emissiveColor = new BABYLON.Color3(0.2,0.5,0)
    material.diffuseColor = new BABYLON.Color3(1,0,0)
    material.backFaceCulling = false
    plotmesh.material = material
}




/**
 * Creates an ArcCamera
 *
 * @param target    Vector3 to look at
 * @param xAngle    Radians of xAngle
 * @param yAngle    Radians of yAngle
 * @param distance  Distance of the camera to target
 */
function createArcCamera(target,xAngle,yAngle,distance)
{
    let camera = new BABYLON.ArcRotateCamera("arcCam",
        xAngle, yAngle, distance, BABYLON.Vector3.Zero(), scene)
    camera.setTarget(target)

    //controls
    camera.attachControl(getCanvas(),true)
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
function getCanvas()
{
   return document.getElementById("babyloncanvas")
}



/**
 * takes care of creating the light
 */
function createLight()
{
    let light = new BABYLON.PointLight("light1", new BABYLON.Vector3(0, 10, 0), scene)
    light.specular = new BABYLON.Color3(0,0,0)
}



/**
 * creates the axes that point into the three x, y and z directions as wireframes
 */
function createAxes()
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
    xPath[0][1] = new BABYLON.Vector3(xLen,0,0)

    yPath = new Array(1)
    yPath[0] = new Array(2)
    yPath[0][0] = new BABYLON.Vector3(0,0,0)
    yPath[0][1] = new BABYLON.Vector3(0,yLen,0)

    zPath = new Array(1)
    zPath[0] = new Array(2)
    zPath[0][0] = new BABYLON.Vector3(0,0,0)
    zPath[0][1] = new BABYLON.Vector3(0,0,zLen)

    let xAxis = BABYLON.Mesh.CreateRibbon("xAxis", xPath, scene)
    let yAxis = BABYLON.Mesh.CreateRibbon("yAxis", yPath, scene)
    let zAxis = BABYLON.Mesh.CreateRibbon("zAxis", zPath, scene)

    let axesMat = new BABYLON.StandardMaterial("material2", scene)
    axesMat.wireframe = true
    axesMat.emissiveColor = new BABYLON.Color3(1,1,1)

    xAxis.material = axesMat
    yAxis.material = axesMat
    zAxis.material = axesMat
}