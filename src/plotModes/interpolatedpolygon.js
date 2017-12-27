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
    // by using nearest neighbor
    let vertices = new Array(xVerticesCount)
    let index = 0
    for(let x = 0;x < xVerticesCount;x++)
    {
        vertices[x] = new Array(zVerticesCount)
        for(let z = 0;z < zVerticesCount;z++)
        {
            vertices[x][z] = planegeometry.vertices[index] // a vertex {x,y,z} with y = 0
            index ++
        }
    }
    let data = new Array(xVerticesCount)
    let counter = new Array(xVerticesCount) // to be able to compute the average
    let datapoint, x, z
    for(x = 0;x < xVerticesCount;x++)
    {
        data[x] = new Array(zVerticesCount)
        counter[x] = new Uint16Array(zVerticesCount)
    }
    for(index = 0;index < df.length;index++)
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
        if(!isNaN(data[x][z]))
        {
            data[x][z] *= counter[x][z]
            data[x][z] += datapoint[x2col]
            counter[x][z] ++
            data[x][z] /= counter[x][z]
        }
        else
        {
            data[x][z] = datapoint[x2col]
            counter[x][z] = 1
        }
    }


    let interpolate = (center, diagonal=true, updown=true, leftright=true) =>
    {
        // make the function easier to use by checking this. it's only for yet undefined points
        if(!isNaN(data[center.x][center.y])) return false

        // diagonal
        let a = null
        let b = null
        let c = null
        let d = null
        if(diagonal)
        {
            a = center.clone().add(new THREE.Vector2( 1,  1))
            b = center.clone().add(new THREE.Vector2(-1, -1))
            c = center.clone().add(new THREE.Vector2(-1,  1))
            d = center.clone().add(new THREE.Vector2( 1, -1))
            while(a.x < data.length && a.y < data[0].length && isNaN(data[a.x][a.y]))
            {
                a.add(new THREE.Vector2( 1,  1))
            }
            while(b.x >= 0 && b.y >= 0 && isNaN(data[b.x][b.y]))
            {
                b.add(new THREE.Vector2(-1, -1))
            }
            while(c.x >= 0 && c.y < data[0].length && isNaN(data[c.x][c.y]))
            {
                c.add(new THREE.Vector2(-1,  1))
            }
            while(d.x < data.length && d.y >= 0 && isNaN(data[d.x][d.y]))
            {
                d.add(new THREE.Vector2( 1, -1))
            }

            // now check if one of the values points to -1 or length, which means no defined vertex was found
            // to make sure that this point is not being considered by overwriting it with Infinity
            // those are the negated conditions from above while-loops
            if(!(a.x < data.length && a.y < data[0].length)) a = null
            if(!(b.x >= 0          && b.y >= 0            )) b = null
            if(!(c.x >= 0          && c.y < data[0].length)) c = null
            if(!(d.x < data.length && d.y >= 0            )) d = null
        }
        
        let g = null
        let h = null
        if(updown)
        {
            // up and down z
            g = center.clone().add(new THREE.Vector2( 0,  1))
            h = center.clone().add(new THREE.Vector2( 0, -1))
            while(g.y < data[0].length && isNaN(data[g.x][g.y]))
            {
                g.add(new THREE.Vector2( 0,  1))
            }
            while(h.y >= 0 && isNaN(data[h.x][h.y]))
            {
                h.add(new THREE.Vector2( 0, -1))
            }
            // both have to be valid, so that the average between those two can be made
            // if only one is valid, that one value will be dragged around the whole plot
            if(!(g.y < data[0].length) || !(h.y >= 0)) { g = null; h = null }
        }

        
        let e = null
        let f = null
        if(leftright)
        {
            // left and right x
            e = center.clone().add(new THREE.Vector2( 1,  0))
            f = center.clone().add(new THREE.Vector2(-1,  0))
            while(e.x < data.length && isNaN(data[e.x][e.y]))
            {
                e.add(new THREE.Vector2( 1,  0))
            }
            while(f.x >= 0 && isNaN(data[f.x][f.y]))
            {
                f.add(new THREE.Vector2(-1,  0))
            }
            if(!(e.x < data.length) || !(f.x >= 0)) { e = null; f = null }
        }


        // now interpolate
        let points = [a, b, c, d, e, f, g, h]
        let invdistancesum = 0 // inverse distance sum, because far away points have less weight
        let interpolatedY = 0
        let dist
        points.map((point) => {
            if(point) // depends on whether or not that point was defined (depends on the diagonal parameter)
            {
                dist = center.distanceTo(point) // euclidian distance. The squared distance will apply not enough weight on far away points
                invdistancesum += 1/dist
                interpolatedY += data[point.x][point.y] * (1/center.distanceTo(point)) // far away points have less weight. euqlidian distance, just like above
            }
        })
        // now the validpoints array contains all the points that are defined in the data array
        // nothing found? maybe the next iteration can find closeby points that are defined in data
        if(invdistancesum === 0)
        {
            return false
        }

        // now average and write into the data array
        interpolatedY /= invdistancesum // divide by the sum of all weights to optain the average
        data[center.x][center.y] = interpolatedY
        return true
    }


    // write all undefined vertex down
    let undefVertexList = new Array(xVerticesCount * zVerticesCount)
    let undefVertexCount = 0
    for(x = 0;x < data.length;x++)
    {
        for(z = 0;z < data[0].length;z++)
        {
            if(isNaN(data[x][z]))
            {
                undefVertexList[undefVertexCount] = {x, z}
                undefVertexCount ++
            }
        }
    }
    let maxIndex = undefVertexCount-1


    let loopOverData = (diagonal=true, updown=true, leftright=true) =>
    {
        // 2. loop over the array and interpolate all array cells that are undefined
        let undefIndex, maxTries
    
        undefIndex = 0
        maxTries = xRes*zRes*2
        // whether or not interpolated points should be used to interpolate. false if only original points are used
        while(undefVertexCount > 0 && maxTries --> 0)
        {
            for(;undefIndex < maxIndex;undefIndex++)
            {
                // it's a bit confusing. undefVertexList contains coordinates of undefined Vertices.
                // this list might contain undefined values, because the coordinate that once was on that index
                // is not about to be interpolated anymore
                if(undefVertexList[undefIndex] !== undefined)
                {
                    break
                }
            }

            if(undefVertexList[undefIndex] === undefined)
            {
                undefIndex = 0
                continue
            }
    
            x = undefVertexList[undefIndex].x
            z = undefVertexList[undefIndex].z
    
            // startingpoint is x, z. try straight first, if it didn't work, add diagonal search
            if(interpolate(new THREE.Vector2(x, z), diagonal, updown, leftright))
            {
                undefVertexList[undefIndex] = undefined
                undefVertexCount --
            }

            undefIndex ++
            if(undefIndex > maxIndex)
                undefIndex = 0
        } 
    }


    // 54 25
    // 2. loop over the array and interpolate all array cells that are undefined
    loopOverData(false, true, true)
    loopOverData(true, true, true)



    // 3. copy the values from that array over to the mesh

    // add a kernel filter over it to smoothen it
    /*let smooth = (x, z, index) =>
    {
        mesh.geometry.vertices[index].y = data[x][z] * 2
        let sum = 2

        if(data[x-1] && data[x-1][z]) { mesh.geometry.vertices[index].y += data[x-1][z]; sum++ }
        if(data[x]   && data[x][z-1]) { mesh.geometry.vertices[index].y += data[x][z-1]; sum++ }
        if(data[x+1] && data[x+1][z]) { mesh.geometry.vertices[index].y += data[x+1][z]; sum++ }
        if(data[x]   && data[x][z+1]) { mesh.geometry.vertices[index].y += data[x][z+1]; sum++ }

        if(data[x-2] && data[x-2][z]) { mesh.geometry.vertices[index].y += data[x-2][z]; sum++ }
        if(data[x]   && data[x][z-2]) { mesh.geometry.vertices[index].y += data[x][z-2]; sum++ }
        if(data[x+2] && data[x+2][z]) { mesh.geometry.vertices[index].y += data[x+2][z]; sum++ }
        if(data[x]   && data[x][z+2]) { mesh.geometry.vertices[index].y += data[x][z+2]; sum++ }
        mesh.geometry.vertices[index].y /= sum
    }*/

    index = 0
    for(let z = 0;z < data[0].length;z++)
    {
        for(let x = 0;x < data.length;x++)
        {
            if(data[x][z] !== undefined)
            {
                mesh.geometry.vertices[index].y = data[x][z]
            }
            else
            {
                mesh.geometry.vertices[index].y = minX2 - 1
            }
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