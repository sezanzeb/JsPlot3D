import * as THREE from "three"

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
    
    let keepOldPlot = appearance.keepOldPlot
    let dataPointSize = appearance.dataPointSize

    let xLen = dimensions.xLen
    let yLen = dimensions.yLen
    let zLen = dimensions.zLen
    
    
    // iterate over dataframe datapoints, connect the latest point with the new one
    //  +---+---+---+--> +   +   +
    // it goes zig zag through the 3D Space

    // Based on scatterplot

    let wireframeLinewidth = dataPointSize*100

    let isItValid = parent.IsPlotmeshValid("lineplot")

    // dispose the old mesh if it is not used/valid anymore
    if(!keepOldPlot || !isItValid)
    {
        parent.disposePlotMesh()

        parent.plotmesh = new THREE.Group()
        parent.plotmesh.name = "lineplot"
        parent.SceneHelper.scene.add(parent.plotmesh)
    }

    // laod the recently used material from the cache
    let material = parent.oldData.material

    // the material is created here
    if(material === null || !isItValid || (material !== null && material != dataPointSize))
    {
        material = new THREE.LineBasicMaterial({
            vertexColors: THREE.VertexColors,
            linewidth: wireframeLinewidth,
            linecap: "round",
            linejoin: "round"
        })

        parent.oldData.material = material
    }

    let group = parent.plotmesh
    let geometry = new THREE.Geometry()
    
    for(let i = 0; i < df.length; i ++)
    {
        let vertex = new THREE.Vector3()
        vertex.x = df[i][x1col]
        vertex.y = df[i][x2col]
        vertex.z = df[i][x3col]

        // three.js handles invalid vertex already by skipping them
        geometry.vertices.push(vertex)
        geometry.colors.push(dfColors[i])
    }

    geometry.verticesNeedUpdate = true
    
    let newDataPointSprites = new THREE.Line(geometry, material)
    
    group.add(newDataPointSprites)

    // normalize
    parent.plotmesh.scale.set(xLen/x1frac,yLen/x2frac,zLen/x3frac)
    parent.plotmesh.position.set(-minX1/x1frac*xLen,-minX2/x2frac*yLen,-minX3/x3frac*zLen)

    parent.benchmarkStamp("made a lineplot")
}