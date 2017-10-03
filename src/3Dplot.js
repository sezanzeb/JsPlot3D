const BABYLON = require("babylonjs")
require("./process.js")

window.addEventListener("DOMContentLoaded", ()=>main())
document.getElementById("formulaForm").addEventListener("submit",(e)=>formulaSubmit(e))


let scene
let plotmesh

//boundaries of the plot data
let xLen = 1
let yLen = 1
let zLen = 1



/**
 * event listener for typed in formulas
 * 
 * @param e     event object from the listener
 */
function formulaSubmit(e)
{
    e.preventDefault() //don't reload page
    createPlotMesh()
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
function plotFunction(x1, x2)
{
    let formula = document.getElementById("formulaText").value
    return eval(formula)
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
    let res = 40

    let path = new Array(xLen)
    for(let i = 0; i <= xLen*res; i++)
    {
        path[i] = new Array(zLen)
        for(let j = 0; j <= zLen*res; j++)
        {
            x = i/res
            z = j/res
            y = plotFunction(x,z)
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


//not sure if i'm going to need the following
/**
 * creates the 3D-plot
 * http://www.html5gamedevs.com/topic/4530-create-a-mesh-from-a-list-of-vertices-and-faces/
 * 
 * @param data      array of [[x1,x2,x3],..] values
 */
function createPlotMesh2(data)
{
    BABYLON.Mesh.CreateBox = function (name, size, scene, updatable)
    {        
        let box = new BABYLON.Mesh(name, scene)
        let normalsSource = [            
            new BABYLON.Vector3(0, 0, 1),            
            new BABYLON.Vector3(0, 0, -1),            
            new BABYLON.Vector3(1, 0, 0),            
            new BABYLON.Vector3(-1, 0, 0),            
            new BABYLON.Vector3(0, 1, 0),            
            new BABYLON.Vector3(0, -1, 0)        
        ]
        let indices = []
        let positions = []
        let normals = []
        let uvs = []
        // Create each face in turn.        
        for (let index = 0; index < normalsSource.length; index++) 
        {            
            let normal = normalsSource[index]
            // Get two vectors perpendicular to the face normal and to each other.            
            let side1 = new BABYLON.Vector3(normal.y, normal.z, normal.x)
            let side2 = BABYLON.Vector3.Cross(normal, side1)
            // Six indices (two triangles) per face.            
            let verticesLength = positions.length / 3
            indices.push(verticesLength)
            indices.push(verticesLength + 1)
            indices.push(verticesLength + 2)
            indices.push(verticesLength)
            indices.push(verticesLength + 2)
            indices.push(verticesLength + 3)
            // Four vertices per face.            
            let vertex = normal.subtract(side1).subtract(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(1.0, 1.0)
            vertex = normal.subtract(side1).add(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(0.0, 1.0)
            vertex = normal.add(side1).add(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(0.0, 0.0)
            vertex = normal.add(side1).subtract(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(1.0, 0.0)
        }        
        box.setVerticesData(positions, BABYLON.VertexBuffer.PositionKind, updatable)
        box.setVerticesData(normals, BABYLON.VertexBuffer.NormalKind, updatable)
        box.setVerticesData(uvs, BABYLON.VertexBuffer.UVKind, updatable)
        box.setIndices(indices)
        return box
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

    camera.lowerRadiusLimit = distance
    camera.upperRadiusLimit = distance
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

    console.log(xPath)

    let axesMat = new BABYLON.StandardMaterial("material2", scene)
    axesMat.wireframe = true
    axesMat.emissiveColor = new BABYLON.Color3(1,1,1)

    xAxis.material = axesMat
    yAxis.material = axesMat
    zAxis.material = axesMat
}