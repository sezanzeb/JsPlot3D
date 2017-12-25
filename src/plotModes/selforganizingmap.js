import * as THREE from "three"
import * as NORMLIB from "../NormalizationLib.js"

// EXPERIMENTAL

/**
 * called from within JsPlot3D.js class plot
 * @param {object} parent this
 * @param {object} df df
 * @param {object} colors {dfColors, hueOffset}
 * @param {object} columns {x1col, x2col, x3col}
 * @param {object} normalization {normalizeX1, normalizeX2, normalizeX3, x1frac, x2frac, x3frac, minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {object} appearance {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize}
 * @param {object} dimensions {xLen, yLen, zLen}
 * @private
 */
export default function selforganizingmap(parent, df, colors, columns, normalization, appearance, dimensions)
{    
    //---------------------//
    //      parameters     //
    //---------------------//
    
    let x1col = columns.x1col
    let x2col = columns.x2col
    let x3col = columns.x3col
    
    let x1frac = normalization.x1frac
    let x2frac = normalization.x2frac
    let x3frac = normalization.x3frac

    let minX1 = normalization.minX1
    let minX2 = normalization.minX2
    let minX3 = normalization.minX3

    let maxX1 = normalization.maxX1
    let maxX2 = normalization.maxX2
    let maxX3 = normalization.maxX3

    let xLen = dimensions.xLen
    let yLen = dimensions.yLen
    let zLen = dimensions.zLen

    let xRes = dimensions.xRes
    let zRes = dimensions.zRes



    //--------------------//
    //     Normalizing    //
    //--------------------//

    // finding min and max
    let minmax
    minmax = NORMLIB.getMinMax(df, x1col, parent.oldData, false, minX1, maxX1)
    minX1 = minmax.min
    maxX1 = minmax.max
    minmax = NORMLIB.getMinMax(df, x2col, parent.oldData, false, minX2, maxX2)
    minX2 = minmax.min
    maxX2 = minmax.max
    minmax = NORMLIB.getMinMax(df, x3col, parent.oldData, false, minX3, maxX3)
    minX3 = minmax.min
    maxX3 = minmax.max
    x1frac = Math.abs(maxX1-minX1)
    if(x1frac === 0) x1frac = 1 // prevent division by zero
    x2frac = Math.abs(maxX2-minX2)
    if(x2frac === 0) x2frac = 1
    x3frac = Math.abs(maxX3-minX3)
    if(x3frac === 0) x3frac = 1



    //--------------------//
    //    Initial Mesh    //
    //--------------------//

    // start from scratch every time
    parent.disposePlotMesh()

    // create plane, divided into segments
    let planegeometry = new THREE.PlaneGeometry(xLen, zLen, xRes, zRes)
    /*let xVerticesCount = (2+(xRes-1))
    let zVerticesCount = (2+(zRes-1))*/

    // move it
    planegeometry.rotateX(Math.PI/2)
    planegeometry.translate(xLen/2,0, zLen/2)
    
    // material
    let plotmat = new THREE.MeshNormalMaterial({
        side: THREE.DoubleSide,
        // vertexColors: THREE.VertexColors,
        // roughness: 0.85
    })

    // finish the mesh
    let mesh = new THREE.Mesh(planegeometry, plotmat)
    mesh.frustumCulled = false // that is not needed, because there is only the centered plot object (no need for three.js to check and compute boundingSpheres -> more performance)
    parent.plotmesh = mesh
    parent.plotmesh.name = "selforganizingmap"
    parent.SceneHelper.scene.add(parent.plotmesh)
    


    //--------------------//
    //        SOM         //
    //--------------------//

    // SOM Algorithm starts here
    let vertices = planegeometry.vertices

    // learning rate. starts at 1 and slowly decreases
    // decreasing learning rates make the plot smoother
    let a = (t) => {
        return 4/(t+4)
    }

    // neighborhood function
    let O = (distance, t) => {

        // let c = 2/(t+4) // decrease the radius of the gaussian function over time
        // a high numinator of c makes the plot more smooth
        // let gauss = Math.pow(Math.E, - distance / c) // distance is already squared
        // return gauss

        // this linear neightborhood function is about 4x faster:
        return Math.max(0, -(t+15) * 0.2 * distance + 1)
    }

    // T iterations over all the datapoints
    let guess, checkvertex, oldDist, xdist, zdist, distance, bestMatchingUnit, weight, datapointx, datapointy, datapointz
    for(let t = 0;t < 80;t++)
    {
        // iterate once over all datapoints
        for(let index = 0;index < df.length; index++)
        {
            // 1. select datapoint (original SOM algorithms takes random point, but random is slower than this)
            datapointx = (df[index][x1col]-minX1) * xLen / x1frac
            datapointy = (df[index][x2col]-minX2) * yLen / x2frac
            datapointz = (df[index][x3col]-minX3) * zLen / x3frac

            // the following only works because i'm looking for the nearest SOM Vertex in terms of x and z and because I'm not modifying x and z in the map:
            
            // the first vertex is at x:0 and z:1
            // first x counts up, then z counts down and x resets to 0, when x reaches the maximum x
            // make a guess where the nearest vertex might be. use xRes and zRes isntead of the verticesCount to avoid making a too large index guess
            // the iterations below will quickly find the bestMatchingUnit because only a few iterations are needed because of the already good guess
            guess = ((xLen - datapointz) * xRes * zRes + datapointx * xRes)|0
    
            // 2. find nearest vertex from SOM (which is planegeometry)
            checkvertex = vertices[guess]
            oldDist = Infinity
            xdist, zdist, distance, bestMatchingUnit
            for(let i = guess;i < vertices.length; i++)
            {
                xdist = checkvertex.x - datapointx
                zdist = checkvertex.z - datapointz
                
                // closest possible vertex already found? (this will quickly be true because of the guess)
                if(Math.abs(xdist) < xLen/xRes && Math.abs(zdist) < zLen/zRes)
                {
                    break
                }

                checkvertex = vertices[i]
                // squared euclidian distance, don't check y
                distance = Math.pow(xdist, 2) + Math.pow(zdist, 2)

                // is it closer?
                if(distance < oldDist)
                {
                    bestMatchingUnit = checkvertex
                    oldDist = distance
                }
            }
    
            // 3. loop over neighborhood
            for(let v = 0;v < vertices.length; v++)
            {
                // get current weights
                weight = vertices[v]
                
                // squared euclidian distance, don't check y
                xdist = weight.x - bestMatchingUnit.x
                zdist = weight.z - bestMatchingUnit.z
                distance = Math.pow(xdist, 2) + Math.pow(zdist, 2)
                // let distance = weight.distanceTo(bestMatchingUnit)
    
                // weight update
                // restrict it to updating the y-value
                // weight.x = weight.x + O(distance, t) * a(t) * (datapointx - weight.x)
                weight.y = weight.y + O(distance, t) * a(t) * (datapointy - weight.y)
                // weight.z = weight.z + O(distance, t) * a(t) * (datapointz - weight.z)
            }
        }

        // uncomment this to watch the SOM work during debugging
        /*mesh.geometry.computeFaceNormals()
        mesh.geometry.computeVertexNormals()
        mesh.geometry.verticesNeedUpdate = true
        parent.SceneHelper.render()*/
    }



    //--------------------//
    //      Rendering     //
    //--------------------//

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

    parent.benchmarkStamp("calculated a self organizing map")
}