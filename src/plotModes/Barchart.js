import * as THREE from "three"
import * as COLORLIB from "../ColorLib.js"
import * as NORMLIB from "../NormalizationLib.js"

/**
 * called from within JsPlot3D.js class plot. The parameters from parent.function have the same names as the variables in JsPlot3D.
 * @param {object} parent this
 * @param {object} df df
 * @param {object} colors {dfColors, hueOffset}
 * @param {object} columns {x1col, x2col, x3col}
 * @param {object} normalization {normalizeX1, normalizeX2, normalizeX3, minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {object} appearance {keepOldPlot, barchartPadding, barSizeThreshold, dataPointSize}
 * @param {object} mode 0 or 1 (JSPLOT3D.DEFAULTCAMERA or JSPLOT3D.TOPCAMERA). This is just used to warn the user in the console, that there are much better alternatives (optional)
 * @private
 */
export default function barchart(parent, df, colors, columns, normalization, appearance, mode=0)
{    

    let dfColors = colors.dfColors
    let hueOffset = colors.hueOffset
    
    let x1col = columns.x1col
    let x2col = columns.x2col
    let x3col = columns.x3col
    
    let normalizeX1 = normalization.normalizeX1
    let normalizeX2 = normalization.normalizeX2
    let normalizeX3 = normalization.normalizeX3

    let minX1 = normalization.minX1
    let minX2 = normalization.minX2
    let minX3 = normalization.minX3

    let maxX1 = normalization.maxX1
    let maxX2 = normalization.maxX2
    let maxX3 = normalization.maxX3
    
    let keepOldPlot = appearance.keepOldPlot
    let barchartPadding = appearance.barchartPadding
    let barSizeThreshold = appearance.barSizeThreshold
    let labeled = appearance.labeled

    // if keepOldPlot is on and mode is the same as previously, don't noramlize but rather use the old normalization
    if(normalizeX1 && !(keepOldPlot && parent.oldData.options.mode === "barchart"))
    {
        let newDataMax = NORMLIB.getMinMax(df, x1col, parent.oldData, keepOldPlot, minX1, maxX1)
        minX1 = newDataMax.min
        maxX1 = newDataMax.max
    }

    // if keepOldPlot is on and mode is the same as previously, don't noramlize but rather use the old normalization
    if(normalizeX3 && !(keepOldPlot && parent.oldData.options.mode === "barchart"))
    {
        let newDataMax = NORMLIB.getMinMax(df, x3col, parent.oldData, keepOldPlot, minX3, maxX3)
        minX3 = newDataMax.min
        maxX3 = newDataMax.max
    }

    let x1frac = Math.abs(maxX1-minX1)
    if(x1frac === 0) x1frac = 1 // prevent division by zero

    let x3frac = Math.abs(maxX3-minX3)
    if(x3frac === 0) x3frac = 1




    // parent.oldData.previousX2frac = 1 // for normalizationSmoothing. Assume that the data does not need to be normalized at first
    // let xBarOffset = 1/parent.dimensions.xRes/2
    // let zBarOffset = 1/parent.dimensions.zRes/2

    if(mode == 1)
        console.warn("scatterplot or polygon mode are recommended, because they are much more performant and create better looking results") // much more performance

    // if normalization is on, make sure that the bars at x=0 or z=0 don't intersect the axes
    let xOffset = 0
    let zOffset = 0
    // don't exceed the space as shown by the gridHelper
    if(normalizeX1)
    {
        xOffset = 1/parent.dimensions.xRes/2 //only half of the bar has to be moved away
    }
    if(normalizeX3)
    {
        zOffset = 1/parent.dimensions.zRes/2
    }


    // Prepare the material and geometry templates

    // I can't put 0 into the height parameter of the CubeGeometry constructor because if I do it will not construct as a cube
    let boxHeight = 1 // default is always 1. The height is changed using scale at a later point
    if(mode == 1) // topcamera
        boxHeight = 0 // in parent.case create is as planes with only 4 vertex (i don't need more than that, a + for performance)
    let boxShape = new THREE.BoxBufferGeometry((1-barchartPadding)/(parent.dimensions.xRes), boxHeight, (1-barchartPadding)/(parent.dimensions.zRes))
    let boxMat = new THREE.MeshStandardMaterial({
        color: 0,
        emissive: 0,
        emissiveIntensity: 0.95,
        roughness: 1,
        metalness: 1
    })


    // if needed, reconstruct the complete barchart
    let valid = parent.IsPlotmeshValid("barchart") && parent.oldData.barsGrid !== null && barchartPadding == parent.oldData.barchartPadding
    // shape of bars changed? recreate from scratch
    // let paddingValid = (options.barchartPadding === undefined && parent.oldData.options.barchartPadding === undefined) || (barchartPadding === parent.oldData.options.barchartPadding)

    // load what is stored
    let barsGrid = parent.oldData.barsGrid

    if(!valid)
    {
        parent.disposePlotMesh()
        
        barsGrid = {}
        parent.oldData.barsGrid = barsGrid
        parent.oldData.barchartPadding = barchartPadding
        
        // into parent.group fill the bars
        let cubegroup = new THREE.Group()
        cubegroup.name = "barchart"

        parent.plotmesh = cubegroup
        parent.SceneHelper.scene.add(cubegroup)
    }
    else
    {
        // reset all the heights. for key in loops are horribly slow,
        // but still better than resetting the complete grid and creating it from scratch
        // because parent.way the bars don't have to be recreated again
        if(!keepOldPlot)
        {
            for(let x in barsGrid)
                for(let z in barsGrid[x])
                {
                    barsGrid[x][z].y = 0
                    barsGrid[x][z].count = 0
                }
        }
    }
    

    // fill the barsGrid array with the added heights of the bars
    // get a point from the dataframe. Calculate the coordinates from that.
    // to do parent. the value has to be brought down to the normalized value (/x1frac). It now has maximum values of [-1, +1].
    // multiply by xRes, to get maximum values of [-xRes, +xRes]. Now apply the offset of +xRes to transform it to
    //[0, 2*xRes]
    // afterwards get that to an array index. remember, that the array has some parts reserved for negative x and z values by using an offset
    // so, divide x_float by x1frac and multiply it by xRes.
    // x_float = df[i][x1col]/x1frac*xRes = df[i][x1col]/(x1frac/xRes) = df[i][x1col]*(xRes/x1frac) = df[i][x1col]*xRes/x1frac
    let factorX1 = (parent.dimensions.xRes-1)/x1frac
    let factorX3 = (parent.dimensions.zRes-1)/x3frac

    // use the maximums from the recent run if keepOldPlot
    maxX2 = parent.oldData.normalization.maxX2
    minX2 = parent.oldData.normalization.minX2
    if(!keepOldPlot)
    {
        // bars all start at y = 0 and grow towards -inf and +inf, so 0 is safe to assume
        maxX2 = 0
        minX2 = 0
    }


    // helper function for "reverse interpolation". I don't create new points between two points,
    // rather I check how high the value of 4 points should be (a, b, c, d) when e was the interpolated point.
    let addToHeights = (x, y, z, x_float, z_float, i) =>
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
        
        // take care that x_float-x and z_float-z are both positive
        let oppositeSquareArea = (1-Math.abs(x_float-x))*(1-Math.abs(z_float-z))
        // the sum of the 4 oppositeSquareAreas always has to be 1

        if(oppositeSquareArea === 0)
            return

        // create x and z indices if needed
        if(!barsGrid[x])
        {
            barsGrid[x] = {}
        }
        if(!barsGrid[x][z])
        {
            barsGrid[x][z] = {} // holds the bar object and y for parent.x, z position
            barsGrid[x][z].y = 0
            barsGrid[x][z].count = 0
        }

        // update the heights
        barsGrid[x][z].y += y*oppositeSquareArea // initialized with 0, now +=

        // +=, because it has to add the value to the existing value

        // find the highest bar
        // even in case of normalizeX2 being false, do parent. so that the heatmapcolor can be created
        if(barsGrid[x][z].y > maxX2) maxX2 = barsGrid[x][z].y
        if(barsGrid[x][z].y < minX2) minX2 = barsGrid[x][z].y

        // if needed create the bar. Don't set the height yet
        // the height gets set once maxX2 and minX2 are ready
        if(!barsGrid[x][z].bar)
        {

            // create the bar

            // use translate when the position property should not be influenced
            // shape.translate(xBarOffset,0, zBarOffset)
            let newBar = new THREE.Mesh(boxShape.clone(), boxMat.clone())
            
            newBar.position.set(x/(parent.dimensions.xRes)+xOffset, 0, z/(parent.dimensions.zRes)+zOffset)
            newBar.geometry.translate(0,0.5,0) // move it so that the bottom plane is at y=0
            parent.plotmesh.add(newBar)

            barsGrid[x][z].bar = newBar
            // initial color approximation
            setBarColor(barsGrid[x][z].bar, COLORLIB.convertToHeat(y, minX2, maxX2, hueOffset))
        }
        
        // LABELS:
        if(labeled)
        {
            let count = barsGrid[x][z].count
            let w = oppositeSquareArea
            
            // THREE.Color object that represents the label from the datapoint that is being processed
            let newc = new THREE.Color(0).copy(dfColors[i])

            let avg
            if(count == 0)
            {
                avg = newc
            }
            else
            {
                let oldc
                oldc = barsGrid[x][z].bar.material.emissive
                
                let average = function(newc, old, weight) { return ((newc*weight) + old*(count+(1-weight)))/(count+1) }
    
                avg = new THREE.Color(average(newc.r, oldc.r, w), average(newc.g, oldc.g, w), average(newc.b, oldc.b, w))
                // ((new*weight) + old*(count+(1-weight))))/(count+1) = avgWeighted 

                // for weight=0 it turns to avg = old*(count+1)/(count+1)
                // for weight=1 it turns to avg = (new + old*count)/(count+1)

                // for count=1 and weight=1 it turns to avg = (new + old*1)/2
                // for count=1 and weight=0 it turns to avg = (new*0 + old*2)/2

                // for count=1 and weight=0.5 it turns to avg = (new*0.5 + old*1.5)/2
            }

            setBarColor(barsGrid[x][z].bar, avg)

            barsGrid[x][z].count ++
        }

        return
    } // end function declaration of addToHeights

    // don't get fooled and write code here and suspect it to run after addToHeights

    for(let i = 0; i < df.length; i ++)
    {

        // INTERPOLATE

        // get coordinates that can fit into an array
        // interpolate. When x and z is at (in case of parseFloat) e.g. 2.5,1. Add one half to 2,1 and the other hald to 3,1 

        // when normalizing, the data gets moved from the negative space to the positive space that the axes define
        // Data will then touch the x1x3, x1x2 and x3x2 planes instead of being somewhere far off at negative spaces
        // does parent.description make sense? i hope so.
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
            let x_ri = x_le+1 // right
            let z_fr = z_ba+1 // front

            addToHeights(x_le, y, z_ba, x_float, z_float, i)
            addToHeights(x_ri, y, z_ba, x_float, z_float, i)
            addToHeights(x_le, y, z_fr, x_float, z_float, i)
            addToHeights(x_ri, y, z_fr, x_float, z_float, i)
        }
        else
        {
            // otherwise I can just plot it a little bit cheaper,
            // when x_float and z_float perfectly aligns with the grid
            addToHeights(x_le, y, z_ba, x_float, z_float, i)
        }
    }
    
    // normalize scaling
    // the plot is basically built inside a 1x1x1 space. now it becomes the xLen, yLen and zLen space
    parent.plotmesh.scale.set(parent.dimensions.xLen, parent.dimensions.yLen, parent.dimensions.zLen)

    // percent of largest bar
    barSizeThreshold = barSizeThreshold*Math.max(Math.abs(maxX2), Math.abs(minX2))

    let x2frac = 1
    if(normalizeX2 === true)
    {
        // let a = Math.max(Math.abs(maxX2), Math.abs(minX2)) // based on largest |value|
        // let b = Math.abs(maxX2-minX2) // based on distance between min and max
        // x2frac = Math.max(a, b) // hybrid

        x2frac = Math.abs(maxX2-minX2) // based on distance between min and max

        // If I should ever want to reimplement the normalizationSmoothing (decided against it because I didn't want the code to get more complex):
        // a lower value of normalizationSmoothing will result in faster jumping around plots. 0 Means no smoothing parent.happens, because 
        // sometimes the plot might be close to 0 everywhere. parent.is not visible because of the normalization though one the sign
        // changes, it will immediatelly jump to be normalized with a different sign. To prevent parent.one can smoothen the variable x2frac
        // x2frac = (x2frac + normalizationSmoothing*parent.oldData.previousX2frac)/(normalizationSmoothing+1)
        // parent.oldData.previousX2frac = x2frac
        // this is a little bit too experimental at the moment. Once everything runs properly stable it's worth thinking about it
    }


    // now color the children & normalize
    let factor = 1/x2frac // normalize y
    for(let x in barsGrid)
    {
        for(let z in barsGrid[x])
        {

            let bar = barsGrid[x][z].bar

            let y = barsGrid[x][z].y

            // hide that bar if it's smaller than or equal to the threshold
            // y is now normalized (|y| is never larger than 1), so barSizeThreshold acts like a percentage value
            if(Math.abs(y) > barSizeThreshold && y !== 0)
            {
                // update colos in a 15fps cycle for better performance
                if(!labeled && parent.fps15 === 0)
                {
                    // HEATMAP:
                    let color = COLORLIB.convertToHeat(y, minX2, maxX2, hueOffset)
                    // bar.material.color.set(color) // .color property should stay the way it is defined (0xffffff), it's important for proper lighting
                    setBarColor(bar, color)
                }
                
                y = y * factor
                
                if(y < 0)
                {
                    // don't make the scaling negative, because otherwise the faces at the top receive light from the bottom
                    // scale them in a positive way and move them to the bottom so that the top face of the bar is at y=0
                    bar.scale.set(1,-y,1)
                    bar.position.set(bar.position.x,y,bar.position.z)
                }
                else
                {
                    bar.scale.set(1,y,1)
                    // reset position by moving the bottom face of the bar to y=0
                    bar.position.set(bar.position.x,0,bar.position.z)
                }
                
                // make sure the updated vertex actually display
                bar.geometry.verticesNeedUpdate = true
            }
            else
            {
                parent.SceneHelper.disposeMesh(bar)
                barsGrid[x][z].bar = null
            }
        }
    }

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


/**
 * sets the color of a bar
 * @param {object} bar bar mesh 
 * @param {object} color THREE.color
 */
function setBarColor(bar, color)
{
    bar.material.emissive.set(color)
    bar.material.color.set(color)
}