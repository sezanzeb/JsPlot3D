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
export default function lineplot(parent, df, colors, columns, normalization, appearance, dimensions)
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
    //      Recycling     //
    //--------------------//

    // bufferedGeometrys (which is how geometries work internally)
    // can only be updated but not changed in size. Or they can be created from scratch and added to the overall group
    // https://threejs.org/docs/#manual/introduction/How-to-update-things

    // dispose the old mesh if it is not used/valid anymore
    let isItValid = parent.IsPlotmeshValid("lineplot")
    if(!keepOldPlot || !isItValid)
    {
        parent.disposePlotMesh()
        parent.plotmesh = new THREE.Group()
        parent.plotmesh.name = "lineplot"
        parent.SceneHelper.scene.add(parent.plotmesh)

        console.log("dispose mesh")
    }


    let wireframeLinewidth = dataPointSize*100
    let material = parent.oldData.lineMaterial
    // if the material is not yet existant, create from scratch
    // no need to check if it is the right material, because it was lodaded from oldData.lineMaterial
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

        material = new THREE.LineBasicMaterial({
            vertexColors: THREE.VertexColors,
            linewidth: wireframeLinewidth,
            linecap: "round",
            linejoin: "round"
        })

        parent.oldData.lineMaterial = material

        console.log("new material")
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
    if(isBufferFull || !newestChildren || material.linewidth != wireframeLinewidth)
    {
        // initialize with a larger size than neccessarry at this point so that new vertices can be added to the geometry
        let size = df.length * 100 // 15, based on the benchmark in /test/visual_tests/h.html
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
        // update the size first (which modifies the material in parent.oldData.lineMaterial)
        // so that next time the material in parent.oldData might be reused because of the matching datapointsize
        // then create a copy so that when parameters in parent.oldData.lineMaterial are changed the previously created sprites are not affected
        geometry = new THREE.BufferGeometry()
        material.linewidth = wireframeLinewidth
        material = material.clone()
        geometry.addAttribute("position", position)
        geometry.addAttribute("color", color)
        group.add(new THREE.Line(geometry, material))

        console.log("new mesh")
    }
    else
    {
        
        // everything is valid and wonderful
        // continue modifying the recently created mesh vertices
        // both material and plotmesh are valid, just use the recently created material
        geometry = group.children[group.children.length-1].geometry
        color = geometry.attributes.color
        position = geometry.attributes.position

        console.log("old mesh")
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




    //--------------------//
    //     Normalizing    //
    //--------------------//

    if(normalizeX1)
    {
        let newDataMax = NORMLIB.getMinMax(df, x1col, parent.oldData, keepOldPlot, minX1, maxX1)
        minX1 = newDataMax.min
        maxX1 = newDataMax.max
    }

    if(normalizeX2)
    {
        let newDataMax = NORMLIB.getMinMax(df, x2col, parent.oldData, keepOldPlot, minX2, maxX2)
        minX2 = newDataMax.min
        maxX2 = newDataMax.max
    }

    if(normalizeX3)
    {
        let newDataMax = NORMLIB.getMinMax(df, x3col, parent.oldData, keepOldPlot, minX3, maxX3)
        minX3 = newDataMax.min
        maxX3 = newDataMax.max
    }

    x1frac = Math.abs(maxX1-minX1)
    if(x1frac === 0) x1frac = 1 // prevent division by zero

    x2frac = Math.abs(maxX2-minX2)
    if(x2frac === 0) x2frac = 1

    x3frac = Math.abs(maxX3-minX3)
    if(x3frac === 0) x3frac = 1

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
    
    parent.benchmarkStamp("made a lineplot")
}