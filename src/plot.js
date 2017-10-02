let BABYLON = require("babylonjs")
window.addEventListener("DOMContentLoaded", ()=>main())


/* TODO
 * https://www.npmjs.com/package/babel-plugin-lodash
 */

let canvas
let scene
let engine


function main()
{
    canvas = document.getElementById("babyloncanvas")
    engine = new BABYLON.Engine(canvas,true)
    createScene()
    engine.runRenderLoop(()=>
    {
        scene.render()
    })
}


function createScene()
{
    scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color3.White()

    let box = BABYLON.Mesh.CreateBox("Box", 4.0, scene)
    let material = new BABYLON.StandardMaterial("material1", scene)
    box.material = material

    let light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 10, 0), scene);

    createArcCamera(
        BABYLON.Vector3.Zero(),
        BABYLON.Tools.ToRadians(45),
        BABYLON.Tools.ToRadians(45),
        10.0)
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
    camera.attachControl(canvas,true)
    camera.keysUp.push(87)
    camera.keysDown.push(83)
    camera.keysLeft.push(65)
    camera.keysRight.push(68)
}
