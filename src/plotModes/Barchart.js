import * as THREE from "three"
import * as COLORLIB from "../ColorLib.js"

/**
 * called from within JsPlot3D.js class plot
 * @param {*} parent this
 * @param {*} df df
 * @param {*} colors {dfColors, hueOffset}
 * @param {*} columns {x1col, x2col, x3col}
 * @param {*} normalization {normalizeX1, normalizeX2, normalizeX3, x1frac, x2frac, x3frac, minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {*} appearance {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize}
 * @private
 */
export default function barchart(parent, df, colors, columns, normalization, appearance, dimensions)
{    
    let dfColors = colors.dfColors
    let hueOffset = colors.hueOffset
    
    let x1col = columns.x1col
    let x2col = columns.x2col
    let x3col = columns.x3col
    
    let normalizeX1 = normalization.normalizeX1
    let normalizeX2 = normalization.normalizeX2
    let normalizeX3 = normalization.normalizeX3
    let x1frac = normalization.x1frac
    let x2frac = normalization.x2frac
    let x3frac = normalization.x3frac
    let minX1 = normalization.minX1
    let minX2 = normalization.minX2
    let minX3 = normalization.minX3
    let maxX1 = normalization.maxX1
    let maxX2 = normalization.maxX2
    let maxX3 = normalization.maxX3
    
    let keepOldPlot = appearance.keepOldPlot
    let barchartPadding = appearance.barchartPadding
    let barSizeThreshold = appearance.barSizeThreshold
    let dataPointSize = appearance.dataPointSize

    let xLen = dimensions.xLen
    let yLen = dimensions.yLen
    let zLen = dimensions.zLen
    
    // parent.oldData.previousX2frac = 1 // for normalizationSmoothing. Assume that the data does not need to be normalized at first
    // let xBarOffset = 1/parent.dimensions.xRes/2
    // let zBarOffset = 1/parent.dimensions.zRes/2



    // if normalization is on, make sure that the bars at x=0 or z=0 don't intersect the axes
    let xOffset = 0
    let zOffset = 0
    // because of the offset, render the bars closer to each other so that they
    // don't exceed the space defined by the gridHelper
    let xfracIncrease = 0
    let zfracIncrease = 0
    if(normalizeX1)
    {
        xOffset = 1/parent.dimensions.xRes/2 //divide by two because to counter the intersection only half of the bar has to be moved away
        xfracIncrease = 1
    }
    if(normalizeX3)
    {
        zOffset = 1/parent.dimensions.zRes/2
        zfracIncrease = 1
    }

    // helper function
    let createBar = (x, z, cubegroup) =>
    {
        // create the bar
        // I can't put 0 into the height parameter of the CubeGeometry constructor because if I do it will not construct as a cube
        let shape = new THREE.CubeGeometry((1-barchartPadding)/(parent.dimensions.xRes+xfracIncrease),1,(1-barchartPadding)/(parent.dimensions.zRes+zfracIncrease))

        // use translate when the position property should not be influenced
        // shape.translate(xBarOffset,0, zBarOffset)

        let plotmat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0,
            emissiveIntensity: 0.98,
            roughness: 1,
            visible: false,
            side: THREE.DoubleSide
        })

        let bar = new THREE.Mesh(shape, plotmat)
        bar.position.set(x/(parent.dimensions.xRes+xfracIncrease)+xOffset,0, z/(parent.dimensions.zRes+zfracIncrease)+zOffset)
        bar.geometry.translate(0,0.5,0)
        cubegroup.add(bar)

        return bar
    }


    // if needed, reconstruct the complete barchart
    let valid = parent.IsPlotmeshValid("barchart")
    // shape of bars changed? recreate from scratch
    // let paddingValid = (options.barchartPadding === undefined && parent.oldData.options.barchartPadding === undefined) || (barchartPadding === parent.oldData.options.barchartPadding)

    if(!valid || !keepOldPlot)
    {
        parent.SceneHelper.disposeMesh(parent.plotmesh)
        parent.resetCache()
        
        parent.oldData.barsGrid = {}
        
        // into this group fill the bars
        let cubegroup = new THREE.Group()
        cubegroup.name = "barchart"

        parent.plotmesh = cubegroup
        parent.SceneHelper.scene.add(cubegroup)
    }

    // load what is stored
    let barsGrid = parent.oldData.barsGrid
    

    // fill the barsGrid array with the added heights of the bars
    // get a point from the dataframe. Calculate the coordinates from that.
    // to do this, the value has to be brought down to the normalized value (/x1frac). It now has maximum values of [-1, +1].
    // multiply by xVerticesCount, to get maximum values of [-xVerticesCount, +xVerticesCount]. Now apply the offset of +xVerticesCount to transform it to
    //[0, 2*xVerticesCount]
    // afterwards get that to an array index. remember, that the array has some parts reserved for negative x and z values by using an offset
    // so, divide x_float by x1frac and multiply it by xVerticesCount.
    // x_float = df[i][x1col]/x1frac*xVerticesCount = df[i][x1col]/(x1frac/xVerticesCount) = df[i][x1col]*(xVerticesCount/x1frac) = df[i][x1col]*xVerticesCount/x1frac
    let factorX1 = (parent.dimensions.xVerticesCount)/x1frac
    let factorX3 = (parent.dimensions.zVerticesCount)/x3frac

    // use the maximums from the recent run if keepOldPlot
    maxX2 = parent.oldData.normalization.maxX2
    minX2 = parent.oldData.normalization.minX2
    if(!keepOldPlot)
    {
        // bars all start at y = 0 and grow towards -inf and +inf, so 0 is safe to assume
        maxX2 = 0
        minX2 = 0
    }


    // helper function for interpolation
    let addToHeights = (x, y, z, x_float, z_float) =>
    {
        /*
            *       a +----------+ b
            *         |     |    |
            *         |-----+    |
            *         |     e    |
            *         |          |
            *       c +----------+ d
            */
        // example: calculate how much to add of y to pixel d. e has the coordinates x_float and z_float
        // calculate the area of the rectangle (called let oppositeSquare) between a (coordinates x and z) and e and multiply that by y
        // that result can be added to [value y of d]
        // small rectangle => small area => small change for d
        // large rectangle => large area => change value at d by a lot
        
        let oppositeSquareArea = Math.abs(1-Math.abs(x-x_float))*(1-Math.abs(z-z_float))

        if(oppositeSquareArea === 0)
            return

        // create x and z indices if needed
        if(barsGrid[x] === undefined)
        {
            barsGrid[x] = {}
        }
        if(barsGrid[x][z] === undefined)
        {
            barsGrid[x][z] = {} // holds the bar object and y for this x, z position
            barsGrid[x][z].y = 0
        }

        // update the heights
        barsGrid[x][z].y += y*oppositeSquareArea // initialized with 0, now +=
        // +=, because otherwise it won't interpolate. It has to add the value to the existing value

        // find the highest bar
        // even in case of normalizeX2 being false, do this, so that the heatmapcolor can be created
        if(barsGrid[x][z].y > maxX2)
            maxX2 = barsGrid[x][z].y
        if(barsGrid[x][z].y < minX2)
            minX2 = barsGrid[x][z].y

        // if needed create the bar. Don't set the height yet
        // the height gets set once maxX2 and minX2 are ready
        if(barsGrid[x][z].bar === undefined)
        {
            barsGrid[x][z].bar = createBar(x, z, parent.plotmesh)
        }
        
        /*console.error(x, z,"is not defined in", barsGrid,
            "this is a bug. This might happen because the code tries to interpolate beyond the "+
            "bounds of the grid, but this normally should not be the case."
        )*/

        return
    } // end function declaration of addToHeights

    // don't get fooled and write code here and suspect it to run after the
    // normalization. Write it below the loop that calls addToHeights. Code below this comment
    // is for preparation of the normalization
    
    for(let i = 0; i < df.length; i ++)
    {

        // INTERPOLATE

        // get coordinates that can fit into an array
        // interpolate. When x and z is at (in case of parseFloat) e.g. 2.5,1. Add one half to 2,1 and the other hald to 3,1 
        
        // DEPRECATED: add the following, because the array is twice as large and the center is supposed to be at [xVertCount][zVertCount]
        // let x_float = df[i][x1col]*factorX1 + parent.dimensions.xVerticesCount+1
        // let z_float = df[i][x3col]*factorX3 + parent.dimensions.zVerticesCount+1

        // when normalizing, the data gets moved from the negative space to the positive space that the axes define
        // Data will then touch the x1x3, x1x2 and x3x2 planes instead of being somewhere far off at negative spaces
        // does this description make sense? i hope so.
        let x_float = (df[i][x1col]-minX1)*factorX1
        let z_float = (df[i][x3col]-minX3)*factorX3
        
        let x_le = x_float|0 // left
        let z_ba = z_float|0 // back

        let y = (df[i][x2col]) // don't normalize yet

        //handle invalid datapoints
        if(isNaN(y))
        {
            console.warn("the dataframe contained a non-number value at", i, x2col,"called \"", y,"\". skipping that datapoint now")
            continue //skip
        }

        // if x_float and z_float it somewhere inbewteen
        if(x_float != x_le || z_float != z_ba)
        {

            addToHeights(x_le, y, z_ba, x_float, z_float)

            let x_ri = x_le+1 // right
            let z_fr = z_ba+1 // front

            addToHeights(x_ri, y, z_ba, x_float, z_float)
            addToHeights(x_le, y, z_fr, x_float, z_float)
            addToHeights(x_ri, y, z_fr, x_float, z_float)
        }
        else
        {
            // otherwise I can just plot it a little bit cheaper,
            // when x_float and z_float perfectly aligns with the grid
            addToHeights(x_le, y, z_ba, x_float, z_float)
        }
    }

    // percent of largest bar
    barSizeThreshold = barSizeThreshold*Math.max(Math.abs(maxX2), Math.abs(minX2))

    if(normalizeX2 === true)
    {
        // let a = Math.max(Math.abs(maxX2), Math.abs(minX2)) // based on largest |value|
        // let b = Math.abs(maxX2-minX2) // based on distance between min and max
        // x2frac = Math.max(a, b) // hybrid

        x2frac = Math.abs(maxX2-minX2) // based on distance between min and max

        // a lower value of normalizationSmoothing will result in faster jumping around plots. 0 Means no smoothing this happens, because 
        // sometimes the plot might be close to 0 everywhere. This is not visible because of the normalization though one the sign
        // changes, it will immediatelly jump to be normalized with a different sign. To prevent this one can smoothen the variable x2frac
        // x2frac = (x2frac + normalizationSmoothing*parent.oldData.previousX2frac)/(normalizationSmoothing+1)
        // parent.oldData.previousX2frac = x2frac
        // this is a little bit too experimental at the moment. Once everything runs properly stable it's worth thinking about it
    }

    // now color the children & normalize
    for(let x in barsGrid)
    {
        for(let z in barsGrid[x])
        {
            let bar = barsGrid[x][z].bar
            if(bar != undefined)
            {
                let y = barsGrid[x][z].y
                
                let color = COLORLIB.convertToHeat(y, minX2, maxX2, hueOffset)
                //bar.material.color.set(color) // .color property should stay the way it is defined (0xffffff), it's important for proper lighting
                bar.material.emissive.set(color)

                // hide that bar if it's smaller than or equal to the threshold
                // y is now normalized (|y| is never larger than 1), so barSizeThreshold acts like a percentage value
                if(Math.abs(y) > barSizeThreshold)
                {
                    // make it visible if it's not zero
                    bar.material.visible = true
                }
                else
                {
                    bar.material.visible = false
                }

                y = y/x2frac*parent.dimensions.yLen
                
                // those are the vertex of the barchart that surround the top face
                // no need to recompute normals, because they still face in the same direction
                bar.geometry.vertices[0].y = y
                bar.geometry.vertices[1].y = y
                bar.geometry.vertices[4].y = y
                bar.geometry.vertices[5].y = y
                
                // make sure the updated vertex actually display
                bar.geometry.verticesNeedUpdate = true
            }
        }
    }

    // write back. as normalization points to the object in the Plot class, it will be overwritten there
    normalization.minX2 = minX2
    normalization.maxX2 = maxX2
}