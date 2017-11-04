import * as THREE from "three"
import * as NORMLIB from "../NormalizationLib.js"

function initScatterplotSprite()
{

}

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



    let isItValid = parent.IsPlotmeshValid("scatterplot")

    // dispose the old mesh if it is not used/valid anymore
    if(!keepOldPlot || !isItValid)
    {
        parent.disposePlotMesh()
        
        parent.plotmesh = new THREE.Group()
        parent.plotmesh.name = "scatterplot"
        parent.SceneHelper.scene.add(parent.plotmesh)
    }
    
    // laod the recently used material from the cache. Maybe that's already enough
    // if not, make a copy and modify it
    // might be from the barchart, might be from a scatterplot
    let material = parent.oldData.material
    
    let geometry, position, color
    let existingVertexCount = 0

    // group is parent.plotmesh, which is of type group
    // it contains all the meshes that are being displayed using sprites
    let group = parent.plotmesh

    // but if an attribute of the material has to be differnet for the new dataframe, it has to be recreated
    // for this, copy a template, overwrite the parameter and use it
    // at this point the material might be a scatterplot material or not. check that with that if term
    if(material === null || !isItValid || (material !== null && material.size != dataPointSize))
    {
        // create from scratch would be an option
        // or copy the material and modify it

        // if not yet existant, create from scratch
        if(material === null)
        {
            // base64 created using tools/getBase64.html and tools/sprite.png
            let circle = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQMAAACQp+OdAAAABlBMVEUAAAD///+l2Z/"+
            "dAAAAAXRSTlMAQObYZgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfhChkUDA4mTwuUAAAAHWlUWHR"+
            "Db21tZW50AAAAAABDcmVhdGVkIHdpdGggR0lNUGQuZQcAAACJSURBVCjPvZK7DcAgDESJUlAyAqMwGhktozACJUWEE+fQORJSlCp"+
            "ueJI/wnd27hHpwLuK7DcEkYqMCHJyxShBkVcoqEV1VGhoQltW6KNb+xfAhjE6iOABxSAAqkEENIMEON4gA/of8OU/8xbzprMas2I"+
            "Uk/Ka4LSAptAmGkcraa7ZzQPgSfBIECf/CnPyltYpaAAAAABJRU5ErkJggg=="
            // advantages over canvas: alpha pixels are not black. no need to redraw the circle

            let datapointSprite = new THREE.TextureLoader().load(circle)
            //let datapointSprite = new THREE.ImageUtils.loadTexture(circle)
            datapointSprite.needsUpdate = true
            // plot it using circle sprites

            datapointSprite.magFilter = THREE.NearestFilter
            datapointSprite.minFilter = THREE.NearestFilter

            // https:// github.com/mrdoob/three.js/issues/1625
            // alphaTest = 1 causes errors
            // alphaTest = 0.9 edgy picture
            // alphaTest = 0.1 black edges on the sprite
            // alphaTest = 0 not transparent infront of other sprites anymore
            // sizeAttenuation: false, sprites don't change size in distance and size is in px
            material = new THREE.PointsMaterial({
                size: dataPointSize,
                map: datapointSprite,
                transparent: true,
                alphaTest: 0.5,
                color: true,
                sizeAttenuation: true,
            })

            parent.oldData.material = material
        }

        // updated the stored size so that next time the material in parent.oldData might be reused
        material.size = dataPointSize
        // now create a copy so that when the size in parent.oldData.material is changed the previously created sprites are not affected
        material = material.clone()
        
        // create a new geometry
        let buffer = createBuffer(df.length * 3 + 1000)
        geometry = buffer.geometry
        color = buffer.colors
        position = buffer.position
    }
    else
    {
        // everything matches in such a good way, that it would be a very
        // good idea to just add the current new vertices (df) to the existing mesh's geometry
        // but since one can'T add vertices to a geometry (buffer size can't be changed, buffer contents can be modified)
        // a check needs to take place to find out if there is still space left in the buffer

        // bufferedGeometrys (which is how geometries work internally)
        // can only be updated but not changed in size. Or they can be created from scratch and added to the overall group
        // https://threejs.org/docs/#manual/introduction/How-to-update-things

        // it's not clear to this point if there even is a mesh available
        // the code might be at this place because the material seemed to be valid. but the meshes might have been disposed
        if(group.children.length != 0)
        {
            geometry = group.children[group.children.length-1].geometry
            existingVertexCount = geometry.attributes.position.count
            position = geometry.attributes.position
            color = geometry.attributes.color
        }
        else
        {
            let buffer = createBuffer(df.length * 3 + 1000)
            geometry = buffer.geometry
            color = buffer.color
            position = buffer.position
        }
    }

    for(let i = 0; i < df.length; i ++)
    {
        /*let vertex = new THREE.Vector3()
        vertex.x = df[i][x1col]
        vertex.y = df[i][x2col]
        vertex.z = df[i][x3col]
 
        // three.js handles invalid vertex already by skipping them
        geometry.vertices.push(vertex)
        geometry.colors.push(dfColors[i])*/

        // todo what about invalid vertex in buffer geometries?
        let j = i + existingVertexCount

        position[j] = df[i][x1col]
        position[j+1] = df[i][x2col]
        position[j+2] = df[i][x3col]

        color[j] = dfColors[i].r
        color[j+1] = dfColors[i].g
        color[j+2] = dfColors[i].b
    }

    // the buffer is being initialized with a larger size than neccessary at this point. now set the actual number of vertices
    //geometry.attributes.position.count = df.length + existingVertexCount

    let newDataPointSprites = new THREE.Points(geometry, material)

    group.add(newDataPointSprites)
    
    // normalize
    parent.plotmesh.scale.set(xLen/x1frac,yLen/x2frac,zLen/x3frac)
    parent.plotmesh.position.set(-minX1/x1frac*xLen,-minX2/x2frac*yLen,-minX3/x3frac*zLen)

    parent.benchmarkStamp("made a scatterplot")

    // return by using the pointers
    normalization.minX1 = minX1
    normalization.maxX1 = maxX1

    normalization.minX2 = minX2
    normalization.maxX2 = maxX2

    normalization.minX3 = minX3
    normalization.maxX3 = maxX3
        
    normalization.x1frac = x1frac
    normalization.x2frac = x2frac
    normalization.x3frac = x3frac
}

function createBuffer(size)
{
    size = 1000*3
    let geometry = new THREE.BufferGeometry()
    // initialize with a larger size than neccessarry at this point so that i can add new vertices to the geometry
    let position = new Float32Array(size)
    let colors = new Float32Array(size)
    geometry.addAttribute("position", new THREE.Float32BufferAttribute(position, 3))
    geometry.addAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    return {geometry, position, colors}
}