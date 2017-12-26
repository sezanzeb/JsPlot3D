import * as THREE from "three"
import * as NORMLIB from "../NormalizationLib.js"
import * as COLORLIB from "../ColorLib.js"

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
export default function interpolatedpolygon(parent, df, colors, columns, normalization, appearance, dimensions)
{    
    //---------------------//
    //      parameters     //
    //---------------------//
    
    let x1col = columns.x1col
    let x2col = columns.x2col
    let x3col = columns.x3col
    
    let hueOffset = colors.hueOffset

    let x1frac = normalization.x1frac
    let x2frac = normalization.x2frac
    let x3frac = normalization.x3frac

    let minX1 = Infinity
    let minX2 = Infinity
    let minX3 = Infinity

    let maxX1 = -Infinity
    let maxX2 = -Infinity
    let maxX3 = -Infinity

    let normalizeX2 = normalization.normalizeX2

    let xLen = dimensions.xLen
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

    parent.disposePlotMesh()

    // create plane, divided into segments
    let planegeometry = new THREE.PlaneGeometry(xLen, zLen, xRes, zRes)
    let xVerticesCount = (2+(xRes-1))
    let zVerticesCount = (2+(zRes-1))
    // xVerticesCount * zVerticesCount = planegeometry.vertices.length

    // move it
    planegeometry.rotateX(Math.PI/2)
    planegeometry.scale(1, 1, -1)
    planegeometry.translate(xLen/2,0, zLen/2)
    
    // color the plane
    let plotmat = new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        vertexColors: THREE.VertexColors,
        roughness: 0.85
    })

    for(let i = 0;i < planegeometry.faces.length; i++)
    {
        let faceColors = planegeometry.faces[i].vertexColors
        faceColors[0] = new THREE.Color(0)
        faceColors[1] = new THREE.Color(0)
        faceColors[2] = new THREE.Color(0)
    }
    
    let mesh = new THREE.Mesh(planegeometry, plotmat)
    mesh.frustumCulled = false // that is not needed, because there is only the centered plot object (no need for three.js to check and compute boundingSpheres -> more performance)
    parent.plotmesh = mesh
    parent.plotmesh.name = "selforganizingmap"
    parent.SceneHelper.scene.add(parent.plotmesh)



    //--------------------//
    //      Algorithm     //
    //--------------------//

    // store all the vertex(pointers) in a 2D array
    let vertices = new Array(xVerticesCount)
    let index = 0
    for(let x = 0;x < xVerticesCount;x++)
    {
        vertices[x] = new Array(zVerticesCount)
        for(let z = 0;z < zVerticesCount;z++)
        {
            vertices[x][z] = planegeometry.vertices[index] // a vertex with y = 0
            index ++
        }
    }

    // 1. store the datapoints in a 2D array by using nearest neighbor for now
    let data = new Array(xVerticesCount)
    for(let x = 0;x < xVerticesCount;x++)
    {
        data[x] = new Array(zVerticesCount)
    }

    let datapoint, x, z
    for(let index = 0;index < df.length;index++)
    {
        // 1. select datapoint and get x and z
        datapoint = df[index]

        /*// this is the normalized datapoint in 3D Coordinates:
        x = (datapoint[x1col] - minX1) * (xLen / x1frac)
        z = (datapoint[x3col] - minX3) * (zLen / x3frac)

        // this is the index in the 2D array that will be used:
        x = x * xRes / xLen | 0
        z = z * zRes / zLen | 0*/

        x = (datapoint[x1col] - minX1) / x1frac * xRes | 0
        z = (datapoint[x3col] - minX3) / x3frac * zRes | 0

        // 2. select vertex in the plane on that position and set the height to it (nearest neighbor)
        if(data[x][z] != undefined)
        {
            data[x][z] += datapoint[x2col]
            data[x][z] /= 2
        }
        else
        {
            data[x][z] = datapoint[x2col]
        }
    }
    

    // 2. loop over the array and interpolate all array cells that are undefined

    // 2.1 X-Interpolation
    let previousValue, nextvalue, xNext, count

    for(let z = 0;z < data[0].length;z++)
    {
        previousValue = null
        for(let x = 0;x < data.length;x++)
        {
            if(data[x][z] == undefined)
            {
                // now start the interpolation

                // 2.1.1 find next value and count how many undefined fields exist INBETWEEN
                xNext = x + 1 // check the next index

                // is this already out of bounds?
                if(xNext == data.length)
                {
                    // that means that x is the index to an undifined field AND the last index of this row
                    // use previousValue in that case
                    data[x][z] = previousValue
                }
                else
                {
                    while(xNext < data.length && data[xNext][z] == undefined)
                    {
                        // is that index also undefined?
                        // look at the next index next time.
                        xNext ++
                    }
                    // 2.1.2 now make an interpolation, but decrease the value down to minX2 with increasing distance from the defined datapoints
                    // found something? If not, xNext will be too large
                    if(xNext == data.length) // out of bounds, so nothing was found
                    {
                        // if previousValue is null, that means the first element was already missing
                        // if there is still nothing found, skip this row
                        if(previousValue == null)
                        {
                            continue
                        }

                        // xNext is too large by 1 element if it was unsuccessful, because an index was about to be checked that was already out of bounds
                        xNext --
                        // if not, fill the whole line with previousValue // TODO leave it empty and try to fill it using Z-Interpolation
                        data[xNext][z] = minX2
                    }

                    if(previousValue == null)
                    {
                        // if previousValue is null, that means the first element in the row was already missing
                        // but later a value has been found
                        // so set previousValue now to minX2 so that an interpolation between minX2 and that found value can happen
                        previousValue = minX2
                    }

                    // the number of undefined vertices
                    count = xNext - x

                    // count contains the number of undefined vertices
                    nextvalue = data[xNext][z]
                    let gradient = (previousValue - nextvalue) / (count+1)
                    let xPrevious = x // remember the position
                    
                    let distance = () =>
                    {
                        // xNext is the position of the next element
                        // xPrevious is the position of the previous element
                        // x is the current position
                        return Math.min(x - xPrevious + 1, xNext - x)
                        // the order in the substraction is important, so that the results are always positive
                        // it always goes from left to right / top to bottom
                    }

                    // this interpolation makes a curve with increasing distance down to minX2
                    for(;x < xNext;x ++)
                    {
                        if(count <= xRes/20+1)
                        {
                            // if only few missing vertex, do linear interpolation
                            data[x][z] = previousValue - gradient
                        }
                        else
                        {
                            // if many missing vertex, make a curve to minX2
                            // make it positive, then divide it, then move it back to it's original position
                            data[x][z] = (previousValue - gradient - minX2) / (distance()+1) + minX2
                        }
                        previousValue = previousValue - gradient
                    }

                    // xNext (x == xNext after above loop) contains a value, put that into previousValue
                    previousValue = data[x][z]
                }
            }
            else
            {
                previousValue = data[x][z]
            }
            index ++
        }
    }

    // 2.2 Z-Interpolation (LINEAR)
    let zNext
    for(let x = 0;x < data.length;x++)
    {
        previousValue = minX2
        for(let z = 0;z < data[0].length;z++)
        {
            if(data[x][z] == undefined)
            {
                // now start the interpolation

                // 2.1.1 find next value and count how many undefined fields exist INBETWEEN
                zNext = z + 1 // check the next index

                // is this already out of bounds?
                if(zNext == data[0].length)
                {
                    // that means that x is the index to an undifined field AND the last index of this row
                    // use previousValue in that case
                    data[x][z] = previousValue
                }
                else
                {
                    while(zNext < data[0].length && data[x][zNext] == undefined)
                    {
                        // look at the next index next time.
                        zNext ++
                    }
                    // 2.1.2 now make a linear interpolation
                    // found something? If not, zNext will be too large
                    if(zNext == data[0].length) // out of bounds, so nothing was found
                    {
                        // zNext is too large by 1 element if it was unsuccessful, because an index was about to be checked that was already out of bounds
                        zNext --

                        // if not, fill the whole line with previousValue
                        data[x][zNext] = minX2
                    }


                    if(previousValue == null) // TODO deprecated?
                    {
                        // if previousValue is null, that means the first element in the row was already missing
                        // but later a value has been found
                        // so set previousValue now to minX2 so that an interpolation between minX2 and that found value can happen
                        previousValue = minX2
                    }

                    // the number of undefined vertices
                    count = zNext - z

                    // count holds the number of vertex with a missing y-value
                    nextvalue = data[x][zNext] // this is either the found value or the generated one by using minX2
                    let gradient = (previousValue - nextvalue) / (count+1)
                    for(;z < zNext;z ++)
                    {
                        // the X-Interpolation created the soft descent down to MINX2
                        // now interpolate between those soft descending vertex. Do it linear
                        data[x][z] = previousValue - gradient
                        previousValue = data[x][z]
                    }

                    // zNext (z == zNext after above loop) contains a value, put that into previousValue
                    previousValue = data[x][z]

                }
            }
            else
            {
                previousValue = data[x][z]
            }
            index ++
        }
    }


    // 3. copy the values from that array over to the mesh

    index = 0
    for(let z = 0;z < data[x].length;z++)
    {
        for(let x = 0;x < data.length;x++)
        {
            // Important: The geometry first counts up the z value, and afterwards
            // increments x (actually based on the rotation of the plane I think).
            // the 2D data array needs to be flattened to the geometry
            mesh.geometry.vertices[index].y = data[x][z]
            index ++
        }
    }

    // 4. scale and translate the mesh to fit normalization

    if(normalizeX2)
    {
        x2frac = Math.abs(maxX2-minX2)/dimensions.yLen
        mesh.scale.set(1,1/x2frac,1) // alters the vertex.y positions
        // move the plot so that the lowest vertex is at y=0 and the highest is at y=yLen
        mesh.position.y = -minX2/x2frac
    }



    //--------------------//
    //        Color       //
    //--------------------//

    let maxClrX2 = maxX2 + (maxX2-minX2)*0.1
    let minClrX2 = minX2 - (maxX2-minX2)*0.1

    // now colorate higher vertex get a warmer value
    let getVertexColor = (v) =>
    {
        let y = mesh.geometry.vertices[v].y

        return COLORLIB.convertToHeat(y, minClrX2, maxClrX2, hueOffset)
    }

    for(let i = 0;i < mesh.geometry.faces.length; i++)
    {
        let face = mesh.geometry.faces[i]
        face.vertexColors[0].set(getVertexColor(face.a))
        face.vertexColors[1].set(getVertexColor(face.b))
        face.vertexColors[2].set(getVertexColor(face.c))
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
    

    //-------------------//
    //     Returning     //
    //-------------------//
    
    // return by using pointers
    normalization.minX1 = minX1
    normalization.maxX1 = maxX1

    normalization.minX2 = minX2
    normalization.maxX2 = maxX2

    normalization.minX3 = minX3
    normalization.maxX3 = maxX3
        
    normalization.x1frac = x1frac
    normalization.x2frac = x2frac
    normalization.x3frac = x3frac

    parent.benchmarkStamp("made a polygon")
}