/**
 * returns min/max for a given dataframe for one dimension
 * 
 * you need to define both the min and max paremeter at the moment if you want to set starting values
 * 
 * @param {object} df dataframe
 * @param {number} col index of the datapoints value that should ne normalized
 * @param {object} oldData oldData object of Plot
 * @param {boolean} keepOldPlot same as the options parameter called keepOldPlot in plotCsvString, plotDataFrame or addDataPoint
 * @param {number} min staring value for min. Set both min and max to 0 or leave them undefined if you don't have start values ready
 * @param {number} max staring value for max. Set both max and min to 0 or leave them undefined if you don't have start values ready
 * @return {object} {min, max}
 */
export function getMinMax(df, col, oldData, keepOldPlot, min, max)
{
    // default values? If yes get startingvalues for min and max from the df
    if(min === 0 && max === 0 || !min || !max)
    {
        min = df[0][col]
        max = df[0][col]
    }

    // determine min and max for normalisation
    for(let i = 0; i < df.length; i++)
    {
        if((df[i][col]) > max) max = df[i][col]
        if((df[i][col]) < min) min = df[i][col]
    }
    
    // take care of normalizing it together with the in oldData stored dataframe in case keepOldPlot is true
    if(keepOldPlot && oldData.dataframe.length !== 0)
    {
        // determine min and max for normalisation
        for(let i = oldData.options.header?1:0; i < oldData.dataframe.length; i++)
        {
            let check = oldData.dataframe[i][col]
            if(check > max) max = check
            if(check < min) min = check
        }
    }

    return {min, max}
}