/**
 * returns min/max for a given dataframe for one dimension
 * 
 * you need to define both the min and max paremeter at the moment if you want to set starting values
 * 
 * @param {object} df dataframe
 * @param {number} col index of the datapoints value that should ne normalized. usually one of the variables x1col, x2col or x3col
 * @param {object} oldData oldData object of Plot
 * @param {boolean} keepOldPlot same as the options parameter called keepOldPlot in plotCsvString, plotDataFrame or addDataPoint
 * @param {number} min starting value for min. Set both min and max to 0 or leave them undefined if you don't have start values ready
 * - could be a old min value for example, so that a new dataframe will be normalized the same way as the old one
 * @param {number} max starting value for max. Set both max and min to 0 or leave them undefined if you don't have start values ready
 * - could be a old max value for example, so that a new dataframe will be normalized the same way as the old one
 * @return {object} {min, max}
 */
export function getMinMax(df, col, oldData, keepOldPlot, min, max)
{
    // default values? If yes get startingvalues for min and max from the df
    // I think min and max === 0 should be deprecated by now
    if(min === 0 && max === 0 || min === undefined || max === undefined)
    {
        min = df[0][col]
        max = df[0][col]
    }

    // due to wrong configuration (parameter col), there could be a string stored in min and max
    if(typeof min !== "number" || typeof max !== "number")
    {
        return console.error("your dataframe contained a non-number value \"", min, "\" at column", col, ". This could be due to " +
        "wrong configuration of your csv-separator, because of a corrupted dataframe or you have selected the wrong column index.")
    }

    // TODO could this be made faster using webassembly?
    // determine min and max for normalisation
    for(let i = 0; i < df.length; i++)
    {
        // don't use Math.max, as it will return NaN if one of the values in the df is not a number
        // because the .csv files might contain some broken data, who knows. So to avoid breaking the
        // whole thing and not displaying anything, do it this way (it will result in false, if df[i][col] contains a string):
        if(df[i][col] > max) max = df[i][col]
        if(df[i][col] < min) min = df[i][col]   
    }

    return {min, max}
}









// Not yet implemented:



/**
 * - TODO logarithmic normalizing (what about the displayed numbers, how are they going to
 * get logarithmic scaling? What about the helper lines)
 * - could be implemented by providing conversion functions here that are used everywhere
 * - I also need to somehow modify the numbers on the axis. I guess the function that creates
 * the numbers on the axis needs to call this function to get the logarithmic scaling
 * - will convert a point to 3D coordinates
 * @param {number} x x-value of the not-yet normalized datapoint
 * @param {number} y y-value of the not-yet normalized datapoint
 * @param {number} z z-value of the not-yet normalized datapoint
 * @param {object} normalization {minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {object} dimensions {xLen, yLen, zLen}
 * @param {boolean} logarithmic when false, linear normalization will be done. When true, a logarithmic scale will be used
 */
function convertTo3DCoordinate(x, y, z, normalization, dimensions, logarithmic=false)
{
    return {x, y, z}
}



/**
 * TODO this will iterate over the vertex in a geometry and apply a logarithmic scale on them
 * @param {object} geometry any THREE.Geometry, but not a BufferGeometry probably
 * @param {*} normalization {minX1, minX2, minX3, maxX1, maxX2, maxX3}
 * @param {object} dimensions {xLen, yLen, zLen}
 */
function logscaleGeometry(geometry, normalization, dimensions)
{
    return geometry
}