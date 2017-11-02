import * as THREE from "three"
import * as COLORLIB from "../ColorLib.js"

/**
 * called from within JsPlot3D.js class plot
 * @param {object} parent this
 * @param {object} colors {hueOffset}
 * @param {object} normalization {normalizeX1, normalizeX2, normalizeX3, x1frac, x2frac, x3frac, minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {object} appearance {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize}
 * @param {object} dimensions {xLen, yLen, zLen}
 * @private
 */
export default function polygon(parent, colors, normalization, appearance, dimensions)
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
            new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                vertexColors: THREE.VertexColors
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

        parent.plotmesh = new THREE.Mesh(planegeometry, plotmat)
        parent.plotmesh.name = "polygonFormula"
    }
    
    // if not, go ahead and manipulate the vertices

    // TODO hiding faces if typeof y is not number:
    // https://stackoverflow.com/questions/11025307/can-i-hide-faces-of-a-mesh-in-three-js

    // modifying vertex positions:
    // https://github.com/mrdoob/three.js/issues/972
    let y = 0

    // the parsed formula is stored in the MathParser object. There is only the need to call f(...) now
    let minX2 = parent.MathParser.f(0, 0) * yLen
    let maxX2 = parent.MathParser.f(0, 0) * yLen

    /*let faceIndex1 = 0
    let faceIndex2 = 0*/

    for(let vIndex = 0; vIndex < parent.plotmesh.geometry.vertices.length; vIndex ++)
    {
        y = parent.MathParser.f(parent.plotmesh.geometry.vertices[vIndex].x, parent.plotmesh.geometry.vertices[vIndex].z)

        /*// in each face there are 3 attributes, which stand for the vertex Indices (Which are vIndex basically)
        // faces are ordered so that the vIndex in .c is in increasing order. If faceIndex.c has an unmatching value, increase
        // the faceindex and therefore switch to a different face which mathes .c with vIndex.
        while(faceIndex1 < parent.plotmesh.geometry.faces.length && parent.plotmesh.geometry.faces[faceIndex1].c < vIndex)
        {
            faceIndex1++
        }
        // the result of this operation is: faces[faceIndex].c === vIndex

        // do similar for faceIndex2.
        while(faceIndex2 < parent.plotmesh.geometry.faces.length && parent.plotmesh.geometry.faces[faceIndex2].a < vIndex)
        {
            faceIndex2++
        }*/
        
        parent.plotmesh.geometry.colors[vIndex] = new THREE.Color(0x6600ff)

        if(!isNaN(y) && Math.abs(y) != Number.POSITIVE_INFINITY && parent.plotmesh.geometry.vertices[vIndex])
        {
            parent.plotmesh.geometry.vertices[vIndex].y = y
            
            if(y > maxX2)
                maxX2 = y
            if(y < minX2)
                minX2 = y
        }
        else
        {
            // console.warn("this does not fully work yet. Some vertex are at y = 0 but that face should be invisible")

            // there are two faces per vertex that have VIndex as face.c
            /*if(parent.plotmesh.geometry.faces[faceIndex1+1] != undefined)
            {
                parent.plotmesh.geometry.faces[faceIndex1].materialIndex = 1
                parent.plotmesh.geometry.faces[faceIndex1+1].materialIndex = 1
                parent.plotmesh.geometry.faces[faceIndex1+2].materialIndex = 1
            }

            //every second face has vIndex as face.a. 0 _ 1 _ 2 _ 3
            if(parent.plotmesh.geometry.faces[faceIndex2] != undefined)
            {
                parent.plotmesh.geometry.faces[faceIndex2].materialIndex = 1
            }*/
            // https://stackoverflow.com/questions/12468906/three-js-updating-geometry-face-materialindex
        }
    }

    
    // now colorate higher vertex get a warmer value
    // multiply min and max to lower the hue contrast and make it appear mor friendly
    let maxClrX2 = maxX2*1.3
    let minClrX2 = minX2*1.3
    let getVertexColor = (v) =>
    {
        let y = parent.plotmesh.geometry.vertices[v].y
        return COLORLIB.convertToHeat(y,minClrX2,maxClrX2,hueOffset)
    }

    // update the numbers along the axes. minimum for x1 and x3 are 0, maximum are the length
    // creating and updating textures is a very costly task. Do this in a 15fps cycle
    if(parent.fps15 === 0)
    {
        for(let i = 0;i < parent.plotmesh.geometry.faces.length; i++)
        {
            let face = parent.plotmesh.geometry.faces[i]
            face.vertexColors[0].set(getVertexColor(face.a))
            face.vertexColors[1].set(getVertexColor(face.b))
            face.vertexColors[2].set(getVertexColor(face.c))
        }
        parent.SceneHelper.updateNumbersAlongAxis(numberDensity, xLen, XAXIS,     0, xLen )
        parent.SceneHelper.updateNumbersAlongAxis(numberDensity, yLen, YAXIS, minX2, maxX2)
        parent.SceneHelper.updateNumbersAlongAxis(numberDensity, zLen, ZAXIS,     0, zLen )
    }
    
    if(normalizeX2)
    {
        let a = Math.max(Math.abs(maxX2), Math.abs(minX2)) // based on largest |value|
        let b = Math.abs(maxX2-minX2) // based on distance between min and max
        x2frac = Math.max(a, b)/dimensions.yLen // hybrid
        parent.plotmesh.geometry.scale(1,1/x2frac,1)
    }

    // name and write down as children so that it can be rendered
    parent.plotmesh.name = "polygonFormula"
    parent.SceneHelper.scene.add(parent.plotmesh)

    // normals need to be recomputed so that the lighting works after the transformation
    parent.plotmesh.geometry.computeFaceNormals()
    parent.plotmesh.geometry.computeVertexNormals()
    parent.plotmesh.geometry.__dirtyNormals = true
    // make sure the updated mesh is actually rendered
    parent.plotmesh.geometry.verticesNeedUpdate = true
    parent.plotmesh.geometry.colorsNeedUpdate = true
    
    parent.plotmesh.material.needsUpdate = true

    parent.SceneHelper.makeSureItRenders(parent.animationFunc)
    
    // return by using pointers
    normalization.minX2 = minX2
    normalization.maxX2 = maxX2
}