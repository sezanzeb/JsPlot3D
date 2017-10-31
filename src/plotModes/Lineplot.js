import * as THREE from "three"

/**
 * called from within JsPlot3D.js class plot
 * @param {object} parent this
 * @param {object} df df
 * @param {object} colors {dfColors, hueOffset}
 * @param {object} columns {x1col, x2col, x3col}
 * @param {object} normalization {normalizeX1, normalizeX2, normalizeX3, x1frac, x2frac, x3frac, minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {object} appearance {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize}
 * @private
 */
export default function lineplot(parent, df, colors, columns, normalization, appearance)
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
    
    
    // iterate over dataframe datapoints, connect the latest point with the new one
    //  +---+---+---+--> +   +   +
    // it goes zig zag through the 3D Space

    // Based on scatterplot

    let wireframeLinewidth = dataPointSize*100

    let isItValid = parent.IsPlotmeshValid("lineplot")
    let isOldMaterialSimilar = (parent.oldData != undefined && parent.oldData.material != undefined && wireframeLinewidth === parent.oldData.material.wireframeLinewidth)

    if(!keepOldPlot || !isItValid || !isOldMaterialSimilar)
    {
        parent.disposePlotMesh()

        let material = new THREE.LineBasicMaterial({
            vertexColors: THREE.VertexColors,
            linewidth: wireframeLinewidth,
            linecap: "round",
            linejoin: "round"
        })

        parent.oldData.material = material
        parent.plotmesh = new THREE.Group()
        parent.plotmesh.name = "lineplot"
        parent.SceneHelper.scene.add(parent.plotmesh)
    }

    let material = parent.oldData.material
    let group = parent.plotmesh
    let geometry = new THREE.Geometry()
    
    for(let i = 0; i < df.length; i ++)
    {
        let vertex = new THREE.Vector3()
        vertex.x = (df[i][x1col]-minX1)/x1frac*parent.dimensions.xLen
        vertex.y = (df[i][x2col]-minX2)/x2frac*parent.dimensions.yLen
        vertex.z = (df[i][x3col]-minX3)/x3frac*parent.dimensions.zLen

        // three.js handles invalid vertex already by skipping them
        geometry.vertices.push(vertex)
        /*if(i > 1)
        {
            let newFace = new THREE.Face3(i-1, i-1, i)
            newFace.vertexColors[0] = dfColors[i-1]
            newFace.vertexColors[1] = dfColors[i-1]
            newFace.vertexColors[2] = dfColors[i]
            geometry.faces.push(newFace)
        }*/

        geometry.colors.push(dfColors[i])
    }

    let newDataPointSprites = new THREE.Line(geometry, material)

    group.add(newDataPointSprites)
}