import * as THREE from "three"


/**
 * converts a number to a heat color and returns a THREE.Color object
 * @param {number} value the number that should be converted to a heat color
 * @param {number} min maximum number present in your dataframe. Default -1
 * @param {number} max minimum number present in your dataframe. Default 1
 * @param {number} hueOffset 0 means no offset. 0.5 means red turns to turqoise. 1 means the offset is so large that red is red again.
 * @return THREE.Color object
 */
export function convertToHeat(value,min=-1,max=1,hueOffset=0)
{
    // set color boundaries so that the colors are heatmap like
    let upperColorBoundary = 0+hueOffset // equals red // what the highest value will get
    let lowerColorBoundary = 0.65+hueOffset // equals blue with a faint purple tone // what the lowest value will get

    value = (value-min)/(max-min) // normalize

    // heatmap
    // make sure all the colors are within the defined range
    value = value * (1 - lowerColorBoundary - (1-upperColorBoundary)) + lowerColorBoundary

    // return that color
    return new THREE.Color(0).setHSL(value,0.95,0.55)
}



/**
 * returns dfColors. An array, indexes are the same as the vertices of the
 * scatterplot in the geometry.vertices array. dfColors contains THREE.Color objects
 * (supports numbers or color strings (0x...,"#...","rgb(...)","hsl(...)"))
 * The parameters have the same names as in JsPlot3D.js. Just forward them to this function
 * @param {any[][]} df the dataframe without the headers
 * @param {number} colorCol the column index of each datapoint, that is used to calculate/parse the color.
 * Example: colorCol is 3. [1324,0.7653,7,"rgb(128,255,0)"]. When labeled is set to false, the datapoint will be colored in lime
 * @param {any} defaultColor if no varying color can be applied to the data, draw all datapoints in this color. Example: "#ff6600"
 * @param {boolean} labeled if true, treat the column indicated in colorCol as labels.
 * Example: when df[line][colorCol] is "tree" it will be red, flower will be a different color and so on
 * @param {boolean} header true if there are headers in the dataframe ("street","number",...)
 * @param {boolean} filterColor wether or not numbers should be filtered to a headmap
 * @param {number} hueOffset color offset. 0.5 inverts the hue (red goes turqoise)
 * @param {object} labelColorMap .labelColorMap attribute of the return value of this function from the past
 * @param {number} numberOfLabels the number of labels that is stored inside (the old) labelColorMap.
 * This is also returned from getColorMap. Also see the description of the labelColorMap parameter
 * @private
 */
export function getColorMap(df, colorCol, defaultColor, labeled, header, filterColor=true, hueOffset=0, labelColorMap={}, numberOfLabels=0)
{
    let dfColors = new Array(df.length) // array of THREE.Color objects that contain the individual color information of each datapoint in the same order as df
    
    let firstDataPointLine = 0
    if(header)
        firstDataPointLine = 1

    // validating the settings.
    // check for labeled == false, because getColorObjctFromAnyString is only important for unlabeled data.
    if(labeled == false && colorCol != -1 && getColorObjectFromAnyString(df[firstDataPointLine][colorCol]) == undefined)
    {

        // didn't work. try some stuff
        if(header == false && df.length >= 2)
        {
            console.warn("the column that is supposed to hold the color information (index "+colorCol+") contained an unrecognized "+
                "string (\""+df[0][colorCol]+"\"). \"labeled\" is set to "+labeled+", \"header\" is set to "+header+" "+
                "Now trying with header = true.")
            header = true
            firstDataPointLine = 1
        }
        
        if(getColorObjectFromAnyString(df[firstDataPointLine][colorCol]) == undefined)
        {
            // assume labels
            console.warn("the column that is supposed to hold the color information (index "+colorCol+") contained an unrecognized "+
                "string (\""+df[0][colorCol]+"\"). \"labeled\" is set to "+labeled+", \"header\" is set to "+header+" "+
                "Now assuming labeled = true.")
            labeled = true
        }
    }

    // if it is not supposed to be rendered as labeled data, avoid
    // printing the old Labels that were eventually passed to this function 
    if(!labeled)
        labelColorMap = {}

    // now create the dfColors array
    if(colorCol != -1) // does the user even want colors?
    {

        // find out min and max values, so that I can do hsl(clr/clrMax,100%,100%)
        let clrMax = df[firstDataPointLine][colorCol]
        let clrMin = df[firstDataPointLine][colorCol]
        // the following function just updates clrMax and clrMin
        let findHighestAndLowest = (value) =>
        {
            if(filterColor && colorCol != -1)
            {
                if(value > clrMax)
                    clrMax = value
                if(value < clrMin)
                    clrMin = value
            }
        }

        // now take care about if the user says it's labeled or not, if it's numbers, hex, rgb, hsl or strings
        // store it inside dfColors[i] if it (can be converted to a number)||(is already a number)

        // parameter. Does the dataset hold classes/labels?
        if(labeled)
        {

            //------------------------//
            //     string labeled     //
            //------------------------//
            // e.g. "group1" "group2" "tall" "small" "0" "1" "flower" "tree"

            // check the second line, because there might be headers accidentally in the first row
            if((df[firstDataPointLine][colorCol]+"").startsWith("rgb") ||
                (df[firstDataPointLine][colorCol]+"").startsWith("hsl") ||
                ((df[firstDataPointLine][colorCol]+"").startsWith("#") && df[0][colorCol].length === 7))
            {
                console.warn(df[0][colorCol]+" might be a color. \"labeled\" is set true. For the stored colors to show up, try \"labeled=false\"")
            }
            
            // count the ammount of labels here
            let label
            for(let i = 0; i < df.length; i++)
            {
                label = df[i][colorCol] // read the label/classification
                if(!labelColorMap[label]) // is this label still unknown?
                {
                    labelColorMap[label] = {}
                    labelColorMap[label].number = numberOfLabels // map it to an unique number
                    labelColorMap[label].color = null
                    numberOfLabels ++ // make sure the next label gets a different number
                }
            }

            // how much distance between each hue:
            let hueDistance = 1/(numberOfLabels)
            for(let i = 0; i < dfColors.length; i++)
            {
                let label = df[i][colorCol]
                let color

                // color not yet added
                if(labelColorMap[label].color === null)
                {
                    color = new THREE.Color(0).setHSL(labelColorMap[label].number*hueDistance+hueOffset,0.95,0.55)
                    labelColorMap[label].color = color // store the label name together with the color
                }
                else
                {
                    // in this case it's an old color that got passed to this function in the parameters (labelColorMap is a parameter)
                    color = labelColorMap[label].color
                }
                dfColors[i] = color
            }

            // CASE 1 dfColors now contains labels
            return {labelColorMap,dfColors,numberOfLabels}
        }
        else
        {

            //------------------------//
            //       color code       //
            //------------------------//
            //#, rgb and hex

            // if it is a string value
            if(isNaN(parseFloat(df[firstDataPointLine][colorCol])))
            {
                filterColor = false // don't apply normalization and heatmapfilters to it

                // try to extract color information from the string
                // check the second line, because there might be headers accidentally in the first row
                if(getColorObjectFromAnyString(df[firstDataPointLine][colorCol]) != undefined)
                {
                    for(let i = 0; i < df.length; i++)
                    {
                        let clr = getColorObjectFromAnyString(df[i][colorCol])
                        if(!clr)
                            clr = new THREE.Color(0)
                        
                        dfColors[i] = clr
                    }
                }

                // CASE 2 dfColors now contains colors created from RGB, # and HSL strings
                return {labelColorMap,dfColors,numberOfLabels: 0}
            }
            else
            {
                //------------------------//
                //         number         //
                //------------------------//
                // examples: 0x3a96cd (3839693) 0xffffff (16777215) 0x000000 (0)

                // it's a number. just copy it over and filter it to a heatmap
                
                for(let i = 0; i < df.length; i++)
                {
                    dfColors[i] = (df[i][colorCol])
                    if(!filterColor)
                        dfColors[i] = (df[i][colorCol])|0
                    else
                        findHighestAndLowest(dfColors[i]) // update clrMin and clrMax
                }

                // This is just a preparation for CASE 3 and CASE 4
            }
        }
        
        // manipulate the color
        if(filterColor) // if filtering is allowed (not the case for rgb, hsl and #hex values)
        {
            // now apply the filters and create a THREE color from the information stored in dfColors
            for(let i = 0;i < df.length; i++)
            {
                let color = dfColors[i]
                // store that color
                dfColors[i] = convertToHeat(color,clrMin,clrMax,hueOffset)
            }

            // CASE 3 dfColors now contains a heatmap
            return {labelColorMap,dfColors,numberOfLabels: 0}
        }
        else
        {
            for(let i = 0;i < df.length; i++)
            {
                let color = dfColors[i]
                // store that color
                dfColors[i] = getColorObjectFromAnyString(color)
            }

            // CASE 4 dfColors now contains many colors, copied from the dataframe
            return {labelColorMap,dfColors,numberOfLabels: 0}
        }
    }
    
    // this is the default case

    for(let i = 0; i < df.length; i++)
        dfColors[i] = getColorObjectFromAnyString(defaultColor)

    // CASE 5 dfColors now contains all the same color
    return {labelColorMap:{}, dfColors,numberOfLabels: 0}
}



/**
 * converts the param color to a THREE.Color object
 * @param {any} color examples: "rgb(0,0.5,1)" "hsl(0.3,0.4,0.7)" 0xff6600 "#72825a"
 */
export function getColorObjectFromAnyString(color)
{
    if(typeof(color) === "number")
        // values with typeof "number" work like this: 0xffffff = 16777215 = white. 0x000000 = 0 = black
        // numbers are supported by three.js by default
        return new THREE.Color(color)


    if(typeof(color) != "number" && typeof(color) != "string")
        return console.error("getColorObjectFromAnyString expected String or Number as parameter but got "+typeof(color))

    // if the code reaches this point, color is a string probably
    // lowercase it to make checking for rgb and hsl simpler
    color = color.toLocaleLowerCase()

    // if it can be parsed, parse it
    let colorNumber = parseFloat(color)
    if(!isNaN(colorNumber))
        return new THREE.Color(colorNumber)

    if(color.startsWith("rgb"))
    {
        // native support by three.js (but make sure it's lowercase, which happens at the beginning of this function)
        return new THREE.Color(color)
    }
    else if(color.startsWith("#"))
    {
        // hex strings are supported by three.js right away aswell
        return new THREE.Color(color)
    }
    else if(color.startsWith("hsl"))
    {
        // remove "hsl", brackets and split it into an array of [r,g,b]
        let hsl = color.substring(4,color.length-1).split(",")
        return new THREE.Color(0).setHSL(parseFloat(hsl[0]),parseFloat(hsl[1]),parseFloat(hsl[2]))
    }
    
    return undefined
}
