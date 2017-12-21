import * as THREE from "three"
import * as NORMLIB from "../NormalizationLib.js"


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
export default function scatterplot(parent, df, colors, columns, normalization, appearance, dimensions)
{

    //---------------------//
    //      parameters     //
    //---------------------//

    let dfColors = colors.dfColors
    
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

    let normalizeX1 = normalization.normalizeX1
    let normalizeX2 = normalization.normalizeX2
    let normalizeX3 = normalization.normalizeX3
    
    let keepOldPlot = appearance.keepOldPlot
    let dataPointSize = appearance.dataPointSize

    let xLen = dimensions.xLen
    let yLen = dimensions.yLen
    let zLen = dimensions.zLen





    //--------------------//
    //     Normalizing    //
    //--------------------//

    // minX1 is usually 0 and it becomes something different when normalizeX1 is true
    // boundingMinX1 is 0 when normalizeX1 is true

    // minX1 is the needed offset for normalization
    // boundingMinX1 is the minX1 in the 3D space, which is 0 after the offset of minX1 is applied

    let boundingMaxX1, boundingMaxX2, boundingMaxX3
    let boundingMinX1, boundingMinX2, boundingMinX3
    let newDataMax

    newDataMax = NORMLIB.getMinMax(df, x1col, parent.oldData, keepOldPlot, minX1, maxX1)
    boundingMinX1 = newDataMax.min
    boundingMaxX1 = newDataMax.max

    newDataMax = NORMLIB.getMinMax(df, x2col, parent.oldData, keepOldPlot, minX2, maxX2)
    boundingMinX2 = newDataMax.min
    boundingMaxX2 = newDataMax.max

    newDataMax = NORMLIB.getMinMax(df, x3col, parent.oldData, keepOldPlot, minX3, maxX3)
    boundingMinX3 = newDataMax.min
    boundingMaxX3 = newDataMax.max

    if(normalizeX1)
    {
        minX1 = boundingMinX1
        maxX1 = boundingMaxX1
        boundingMinX1 = 0
        boundingMaxX1 = xLen
    }

    if(normalizeX2)
    {
        minX2 = boundingMinX2
        maxX2 = boundingMaxX2
        boundingMinX2 = 0
        boundingMaxX2 = yLen
    }

    if(normalizeX3)
    {
        minX3 = boundingMinX3
        maxX3 = boundingMaxX3
        boundingMinX3 = 0
        boundingMaxX3 = zLen
    }

    x1frac = Math.abs(maxX1-minX1)
    if(x1frac === 0) x1frac = 1 // prevent division by zero

    x2frac = Math.abs(maxX2-minX2)
    if(x2frac === 0) x2frac = 1

    x3frac = Math.abs(maxX3-minX3)
    if(x3frac === 0) x3frac = 1



    //--------------------//
    //      Recycling     //
    //--------------------//

    // bufferedGeometrys (which is how geometries work internally)
    // can only be updated but not changed in size. Or they can be created from scratch and added to the overall group
    // https://threejs.org/docs/#manual/introduction/How-to-update-things

    // dispose the old mesh if it is not used/valid anymore
    let isItValid = parent.IsPlotmeshValid("scatterplot")
    if(!keepOldPlot || !isItValid)
    {
        parent.disposePlotMesh()
        parent.plotmesh = new THREE.Group()
        parent.plotmesh.name = "scatterplot"
        parent.SceneHelper.scene.add(parent.plotmesh)

        // console.log("dispose mesh")
    }


    let material = parent.oldData.scatterMaterial
    // if the material is not yet existant, create from scratch
    // no need to check if it is the right material, because it was lodaded from oldData.scatterMaterial
    if(!material)
    {
        // base64 created using tools/getBase64.html and tools/sprite.png
        let circle = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQMAAACQp+OdAAAABlBMVEUAAAD///+l2Z/"+
        "dAAAAAXRSTlMAQObYZgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfhChkUDA4mTwuUAAAAHWlUWHR"+
        "Db21tZW50AAAAAABDcmVhdGVkIHdpdGggR0lNUGQuZQcAAACJSURBVCjPvZK7DcAgDESJUlAyAqMwGhktozACJUWEE+fQORJSlCp"+
        "ueJI/wnd27hHpwLuK7DcEkYqMCHJyxShBkVcoqEV1VGhoQltW6KNb+xfAhjE6iOABxSAAqkEENIMEON4gA/of8OU/8xbzprMas2I"+
        "Uk/Ka4LSAptAmGkcraa7ZzQPgSfBIECf/CnPyltYpaAAAAABJRU5ErkJggg=="

        let datapointSprite = new THREE.TextureLoader().load(circle)
        datapointSprite.needsUpdate = true
        datapointSprite.magFilter = THREE.NearestFilter
        datapointSprite.minFilter = THREE.NearestFilter

        material = new THREE.PointsMaterial({
            size: dataPointSize,
            map: datapointSprite,
            transparent: true,
            alphaTest: 0.5,
            vertexColors: THREE.VertexColors,
            sizeAttenuation: true,
        })

        parent.oldData.scatterMaterial = material

        // console.log("new material")
    }
    

    // group is parent.plotmesh, which is of type group
    // it contains all the meshes that are being displayed using sprites
    let group = parent.plotmesh
    let geometry, position, color


    // is the buffer of the most recently used object full?
    let newestChildren = group.children[parent.plotmesh.children.length-1]
    let isBufferFull = newestChildren && newestChildren.geometry.attributes.position.realCount >= newestChildren.geometry.attributes.position.count


    // if an attribute of the material has to be differnet for the new dataframe, the material has to be (first) modified and (then) dereferenced
    // note: newestChildren might be undefined because it has recently been disposed or no scatteprlot has ever been added to the plotmesh group
    if(isBufferFull || !newestChildren || material.size != dataPointSize)
    {
        // initialize with a larger size than neccessarry at this point so that new vertices can be added to the geometry
        let size = df.length * 15 // 15, based on the benchmark in /test/visual_tests/h.html
        position = new THREE.Float32BufferAttribute(new Float32Array(size * 3), 3)
        color = new THREE.Float32BufferAttribute(new Float32Array(size * 3), 3)
        for(let i = 0;i < position.array.length; i++)
        {
            // move it out of the viewport
            position.array[i] = Number.MAX_SAFE_INTEGER
        }

        // no vertices have been added yet. count them using position.realCount
        position.realCount = 0

        // tells the gpu that this array changes a lot (due to scaling & translating for normalization and the adding of new vertices)
        position.dynamic = true
        color.dynamic = true

        // finish the geometry
        // update the size first (which modifies the material in parent.oldData.scatterMaterial)
        // so that next time the material in parent.oldData might be reused because of the matching datapointsize
        // then create a copy so that when parameters in parent.oldData.scatterMaterial are changed the previously created sprites are not affected
        geometry = new THREE.BufferGeometry()
        material.size = dataPointSize
        material = material.clone()
        geometry.addAttribute("position", position)
        geometry.addAttribute("color", color)
        let points = new THREE.Points(geometry, material)
        points.frustumCulled = false // that is not needed, because there is only the centered plot object (no need for three.js to check and compute boundingSpheres -> more performance)
        group.add(points)

        // console.log("new mesh")
    }
    else
    {
        
        // everything is valid and wonderful
        // continue modifying the recently created mesh vertices
        // both material and plotmesh are valid, just use the recently created material
        geometry = group.children[group.children.length-1].geometry
        color = geometry.attributes.color
        position = geometry.attributes.position

        // console.log("old mesh")
    }



    //-------------------//
    //      Filling      //
    //-------------------//

    // add the dataframe to the positions and colors
    for(let i = 0; i < df.length; i ++)
    {
        // todo what about invalid vertex in buffer geometries?
        let j = i + position.realCount

        position.array[j*3] = df[i][x1col]
        position.array[j*3+1] = df[i][x2col]
        position.array[j*3+2] = df[i][x3col]

        color.array[j*3] = dfColors[i].r
        color.array[j*3+1] = dfColors[i].g
        color.array[j*3+2] = dfColors[i].b
    }
    // write down where the overwriting of the buffer can continue
    position.realCount += df.length

    // finish
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true

    parent.plotmesh.scale.set(xLen/x1frac,yLen/x2frac,zLen/x3frac)
    parent.plotmesh.position.set(-minX1/x1frac*xLen,-minX2/x2frac*yLen,-minX3/x3frac*zLen)



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
    
    parent.benchmarkStamp("made a scatterplot")
}