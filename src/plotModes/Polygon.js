import * as THREE from "three"
import * as COLORLIB from "../ColorLib.js"

/**
 * called from within JsPlot3D.js class plot
 * @param {function} foo example: function() { return 1 } or MathParser.f
 * @param {object} parent this
 * @param {object} colors {hueOffset}
 * @param {object} normalization {normalizeX1, normalizeX2, normalizeX3, x1frac, x2frac, x3frac, minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {object} appearance {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize}
 * @param {object} dimensions {xLen, yLen, zLen}
 * @private
 */
export default function polygon(foo, parent, colors, normalization, appearance, dimensions)
{   
    const XAXIS = 1
    const YAXIS = 2
    const ZAXIS = 3

    let hueOffset = colors.hueOffset

    let xLen = dimensions.xLen
    let yLen = dimensions.yLen
    let zLen = dimensions.zLen
    let xRes = dimensions.xRes
    let zRes = dimensions.zRes
    
    let normalizeX2 = normalization.normalizeX2
    let x2frac = normalization.x2frac

    let numberDensity = appearance.numberDensity
    
    
    // TODO:
    // https://stackoverflow.com/questions/12468906/three-js-updating-geometry-face-materialindex
    // This requires some more work. -inf and +inf values should be indicated by hidden faces around those vertices

    // might need to recreate the geometry and the matieral
    // is there a plotmesh already? Or maybe a plotmesh that is not created from a 3D Plane (could be a scatterplot or something else)
    // no need to check keepOldPlot because it is allowed to use the old mesh every time (if IsPlotmeshValid says it's valid)
    let mesh = parent.plotmesh // assume parents plotmesh, it might be still valid. then check it
    // no need to check for xRes, zRes, xLen, yLen and zLen because opon setDimension the plotmesh gets disposed. So if plotmesh
    // is still there and has the name "polygonFormula", it is guaranteed to have the same dimensions and vertices counts
    if(!parent.IsPlotmeshValid("polygonFormula"))
    {
        parent.disposePlotMesh()

        // create plane, divided into segments
        let planegeometry = new THREE.PlaneGeometry(xLen, zLen, xRes, zRes)
        // move it
        planegeometry.rotateX(Math.PI/2)
        planegeometry.translate(xLen/2,0, zLen/2)

        // color the plane
        let plotmat = [
            new THREE.MeshStandardMaterial({
                side: THREE.DoubleSide,
                vertexColors: THREE.VertexColors,
                roughness: 0.85
            }),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0
            })
        ]

        for(let i = 0;i < planegeometry.faces.length; i++)
        {
            let faceColors = planegeometry.faces[i].vertexColors
            faceColors[0] = new THREE.Color(0)
            faceColors[1] = new THREE.Color(0)
            faceColors[2] = new THREE.Color(0)
        }

        mesh = new THREE.Mesh(planegeometry, plotmat)
        mesh.frustumCulled = false // that is not needed, because there is only the centered plot object (no need for three.js to check and compute boundingSpheres -> more performance)
        parent.plotmesh = mesh
        parent.plotmesh.name = "polygonFormula"
    }
    
    // if not, go ahead and manipulate the vertices

    // TODO hiding faces if typeof y is not number:
    // https://stackoverflow.com/questions/11025307/can-i-hide-faces-of-a-mesh-in-three-js

    // modifying vertex positions:
    // https://github.com/mrdoob/three.js/issues/972
    let y = 0

    // find out the first point that creates a finite value
    let undefinedVal
    for(let vIndex = 0; vIndex < mesh.geometry.vertices.length; vIndex ++)
    {
        let vertex = mesh.geometry.vertices[vIndex]
        undefinedVal = foo(vertex.x, vertex.z)
        if(isFinite(undefinedVal))
        {
            break
        }
    }

    let minX2 = Infinity
    let maxX2 = -Infinity

    /*let faceIndex1 = 0
    let faceIndex2 = 0*/

    // loop over the vertices of the geometry and modify them to match the formula
    for(let vIndex = 0; vIndex < mesh.geometry.vertices.length; vIndex ++)
    {
        let vertex = mesh.geometry.vertices[vIndex]
        y = foo(vertex.x, vertex.z)

        // taking care of 1/0 Infinite NaN stuff
        if(!isFinite(y))
            y = undefinedVal

        /*// in each face there are 3 attributes, which stand for the vertex Indices (Which are vIndex basically)
        // faces are ordered so that the vIndex in .c is in increasing order. If faceIndex.c has an unmatching value, increase
        // the faceindex and therefore switch to a different face which mathes .c with vIndex.
        while(faceIndex1 < mesh.geometry.faces.length && mesh.geometry.faces[faceIndex1].c < vIndex)
        {
            faceIndex1++
        }
        // the result of this operation is: faces[faceIndex].c === vIndex

        // do similar for faceIndex2.
        while(faceIndex2 < mesh.geometry.faces.length && mesh.geometry.faces[faceIndex2].a < vIndex)
        {
            faceIndex2++
        }*/
        
        // TODO what is the following line doing and why
        mesh.geometry.colors[vIndex] = new THREE.Color(0x6600ff)

        if(!isNaN(y) && Math.abs(y) != Number.POSITIVE_INFINITY && vertex)
        {            
            maxX2 = Math.max(y, maxX2)
            minX2 = Math.min(y, minX2)
            vertex.y = y
        }
        else
        {
            // console.warn("this does not fully work yet. Some vertex are at y = 0, but the face that is connected to that vertex should be invisible")

            // there are two faces per vertex that have VIndex as face.c
            /*if(mesh.geometry.faces[faceIndex1+1] != undefined)
            {
                mesh.geometry.faces[faceIndex1].materialIndex = 1
                mesh.geometry.faces[faceIndex1+1].materialIndex = 1
                mesh.geometry.faces[faceIndex1+2].materialIndex = 1
            }

            //every second face has vIndex as face.a. 0 _ 1 _ 2 _ 3
            if(mesh.geometry.faces[faceIndex2] != undefined)
            {
                mesh.geometry.faces[faceIndex2].materialIndex = 1
            }*/
            // https://stackoverflow.com/questions/12468906/three-js-updating-geometry-face-materialindex
        }
    }

    // minX2 and maxX2 are now available

    // increase/decrease min and max to lower the hue contrast and make it appear more friendly
    let maxClrX2 = maxX2 + (maxX2-minX2)*0.15
    let minClrX2 = minX2 - (maxX2-minX2)*0.15

    if(normalizeX2)
    {
        x2frac = Math.abs(maxX2-minX2)/dimensions.yLen
        mesh.scale.set(1,1/x2frac,1) // alters the vertex.y positions
        // move the plot so that the lowest vertex is at y=0 and the highest is at y=yLen
        mesh.position.y = -minX2/x2frac
    }
    else
    {
        mesh.scale.set(1,1,1)
        mesh.position.y = 0
        // based on the user settings for normalization, min and max might have to contain 0 and the axis length, so that numbers are being displayed with the correct value
        minX2 = 0
        maxX2 = yLen
    }

    // now colorate higher vertex get a warmer value
    let getVertexColor = (v) =>
    {
        let y = mesh.geometry.vertices[v].y

        return COLORLIB.convertToHeat(y, minClrX2, maxClrX2, hueOffset)
    }

    // update the numbers along the axes. minimum for x1 and x3 are 0, maximum are the length
    // creating and updating textures is a very costly task. Do this in a 15fps cycle
    if(parent.fps15 === 0)
    {
        for(let i = 0;i < mesh.geometry.faces.length; i++)
        {
            let face = mesh.geometry.faces[i]
            face.vertexColors[0].set(getVertexColor(face.a))
            face.vertexColors[1].set(getVertexColor(face.b))
            face.vertexColors[2].set(getVertexColor(face.c))
        }
        parent.SceneHelper.updateNumbersAlongAxis(numberDensity, xLen, XAXIS,     0, xLen )
        parent.SceneHelper.updateNumbersAlongAxis(numberDensity, yLen, YAXIS, minX2, maxX2)
        parent.SceneHelper.updateNumbersAlongAxis(numberDensity, zLen, ZAXIS,     0, zLen )
    }

    // name and write down as children so that it can be rendered
    mesh.name = "polygonFormula"
    parent.SceneHelper.scene.add(parent.plotmesh)

    // normals need to be recomputed so that the lighting works after the transformation
    mesh.geometry.computeFaceNormals()
    mesh.geometry.computeVertexNormals()
    mesh.geometry.__dirtyNormals = true
    // make sure the updated mesh is actually rendered
    mesh.geometry.verticesNeedUpdate = true
    mesh.geometry.colorsNeedUpdate = true
    
    mesh.material.needsUpdate = true

    parent.SceneHelper.makeSureItRenders(parent.animationFunc)
    
    // return by using pointers
    normalization.minX2 = minX2
    normalization.maxX2 = maxX2
}