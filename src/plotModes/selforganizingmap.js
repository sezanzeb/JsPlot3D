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

    let keepOldPlot = appearance.keepOldPlot

    let datapointgeometry = new THREE.Geometry()

    // finding min and max
    let minmax
    minmax = NORMLIB.getMinMax(df, x1col, parent.oldData, keepOldPlot, minX1, maxX1)
    minX1 = minmax.min
    maxX1 = minmax.max
    minmax = NORMLIB.getMinMax(df, x2col, parent.oldData, keepOldPlot, minX2, maxX2)
    minX2 = minmax.min
    maxX2 = minmax.max
    minmax = NORMLIB.getMinMax(df, x3col, parent.oldData, keepOldPlot, minX3, maxX3)
    minX3 = minmax.min
    maxX3 = minmax.max
    x1frac = Math.abs(maxX1-minX1)
    if(x1frac === 0) x1frac = 1 // prevent division by zero
    x2frac = Math.abs(maxX2-minX2)
    if(x2frac === 0) x2frac = 1
    x3frac = Math.abs(maxX3-minX3)
    if(x3frac === 0) x3frac = 1

    parent.disposePlotMesh()

    // create plane, divided into segments
    let planegeometry = new THREE.PlaneGeometry(xLen, zLen, xRes, zRes)
    // move it
    planegeometry.rotateX(Math.PI/2)
    planegeometry.translate(xLen/2,0, zLen/2)
    //
    // color the plane
    let plotmat = new THREE.MeshNormalMaterial({
        side: THREE.DoubleSide,
        vertexColors: THREE.VertexColors,
        roughness: 0.85
    })
    //
    for(let i = 0;i < planegeometry.faces.length; i++)
    {
        let faceColors = planegeometry.faces[i].vertexColors
        faceColors[0] = new THREE.Color(0)
        faceColors[1] = new THREE.Color(0)
        faceColors[2] = new THREE.Color(0)
    }
    //
    let mesh = new THREE.Mesh(planegeometry, plotmat)
    mesh.frustumCulled = false // that is not needed, because there is only the centered plot object (no need for three.js to check and compute boundingSpheres -> more performance)
    parent.plotmesh = mesh
    parent.plotmesh.name = "selforganizingmap"
    parent.SceneHelper.scene.add(parent.plotmesh)


    for(let i = 0; i < df.length; i ++)
    {
        let vertex = new THREE.Vector3()
        vertex.x = df[i][x1col]
        vertex.y = df[i][x2col]
        vertex.z = df[i][x3col]

        // three.js handles invalid vertex already by skipping them
        datapointgeometry.vertices.push(vertex)
    }
    
    // normalize
    datapointgeometry.scale(xLen/x1frac, yLen/x2frac, zLen/x3frac)
    datapointgeometry.translate(-minX1/x1frac*xLen, -minX2/x2frac*yLen, -minX3/x3frac*zLen)

    // now geometry contains the normalized datapoints
    
    // SOM Algorithm starts here
    for(let i = 0;i < planegeometry.vertices.length;i++)
    {
        let vertex = planegeometry.vertices[i]
        vertex.xOriginal = vertex.x
        vertex.yOriginal = vertex.y
        vertex.zOriginal = vertex.z
    }

    for(let t = 1;t < 1000;t++)
    {
        // 1. select random datapoint from the datapointgeometry, because it is normalized and stuff
        let index = Math.random() * datapointgeometry.vertices.length | 0
        let datapoint = datapointgeometry.vertices[index]

        // 2. find nearest vertex from SOM (which is planegeometry)
        let bestMatchingUnit = planegeometry.vertices[0]
        let oldDist = Infinity
        for(let i = 0;i < planegeometry.vertices.length; i++)
        {
            let checkvertex = planegeometry.vertices[i]
            let dist = checkvertex.distanceTo(datapoint)

            if(dist < oldDist)
            {
                bestMatchingUnit = checkvertex
                oldDist = dist
            }
        }

        // 3. loop over neighborhood
        for(let v = 0;v < planegeometry.vertices.length; v++)
        {
            // get current weights
            let weight = planegeometry.vertices[v]
            
            // euclidian distance
            let xdist = weight.x - bestMatchingUnit.x
            let zdist = weight.z - bestMatchingUnit.z
            let distance = Math.sqrt(Math.pow(xdist, 2) + Math.pow(zdist, 2))

            // learning rate depends on progress
            let a = (t) => {
                return 1/(t+1)
            }

            // neighborhood function
            let O = (distance) => {
                let c = 0.1
                let gauss = Math.pow(Math.E, - Math.pow(distance, 2) / c)
                return gauss
            }

            // weight update
            weight.x = weight.x + O(distance) * a(t) * (datapoint.x - weight.x)
            weight.y = weight.y + O(distance) * a(t) * (datapoint.y - weight.y)
            weight.z = weight.z + O(distance) * a(t) * (datapoint.z - weight.z)
        }

        mesh.geometry.computeFaceNormals()
        mesh.geometry.computeVertexNormals()
        mesh.geometry.verticesNeedUpdate = true
        parent.SceneHelper.render()

    }


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

    parent.benchmarkStamp("made a scatterplot")
}