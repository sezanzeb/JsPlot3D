const THREE = require("three")


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

    value = parseFloat(value)
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
 * @param {boolean} filterColor wether or not numbers should be filtered to a headmap
 * @return An array, indexes are the same as the vertices of the scatterplot in the geometry.vertices array. it contains THREE.Color objects
 * @private
 */
export function getColorMap(df,colorCol,defaultColor,labeled,header,filterColor=true,hueOffset=0)
{
    let dfColors = new Array(df.length) // array of THREE.Color objects that contain the individual color information of each datapoint in the same order as df
    
    if(colorCol != -1 && df.length >= 2) // does the user even want colors? Are there even a few datapoints so that they can be colored in different ways?
    {
        let numberOfLabels = 0
        // let numberOfLabels = df.length
        // the color gets divided by (1-1/numberOfLabels) so that red does not appear twice.
        // e.g. 3 labels would be red, turqoise, red. if numberOfLabels would get initialized with 0, that formula would diverge to -inf
        // 1 would make that term zero, so that the color would diverge to inf. a high number converges that term to 1, so the color won't be touched

        // take care that all the labels are numbers
        let map = {}
        let labelColorMap = {} // store label names together with the used color

        // also normalize the colors so that I can do hsl(clr/clrMax,100%,100%)
        // no need to check if it's numbers or not, because dfColors carries only numbers
        // Assume the first value. No worries about wether or not those are actually numbers, because if not the script below will take care
        let clrMax = df[1][colorCol]
        let clrMin = df[1][colorCol]
        
        // the following function just updates clrMax and clrMin, only available within the function that wraps this (getColorMap(...))
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
        if(labeled) // get 0.6315 from 2.6351 or 0 from 2. this way check if there are comma values
        {

            //------------------------//
            //     string labeled     //
            //------------------------//
            // e.g. "group1" "group2" "tall" "small" "0" "1" "flower" "tree"

            // check the second line, because there might be headers accidentally in the first row
            if((df[1][colorCol]+"").startsWith("rgb") ||
            (df[1][colorCol]+"").startsWith("hsl") ||
            ((df[1][colorCol]+"").startsWith("#") && df[0][colorCol].length == 7))
            {
                console.warn(df[0][colorCol]+" might be a color. \"labeled\" is set true. For the stored colors to show up, try \"labeled=false\"")
            }
            
            // count the ammount of labels here
            let label = ""
            for(let i = 0; i < df.length; i++)
            {
                label = df[i][colorCol] // read the label/classification
                if(map[label] == undefined) // is this label still unknown?
                {
                    map[label] = numberOfLabels // map it to an unique number
                    numberOfLabels ++ // make sure the next label gets a different number
                }
                // copy the labels to dfColors as numbers. They are going to be converted to THREE.Color objects in the next loop.
                dfColors[i] = parseFloat(map[label])
                findHighestAndLowest(dfColors[i]) // update clrMin and clrMax
            }

            // how much distance between each hue:
            let hueDistance = 1/(numberOfLabels)
            for(let i = 0; i < dfColors.length; i++)
            {
                dfColors[i] = new THREE.Color(0).setHSL(dfColors[i]*hueDistance+hueOffset,0.95,0.55)
                labelColorMap[df[i][colorCol]] = dfColors[i] // store the label name together with the color
            }

            // CASE 1 dfColors now contains labels
            return {labelColorMap,dfColors}
        }
        else
        {

            //------------------------//
            //       color code       //
            //------------------------//
            //#, rgb and hex

            // if it is a string value
            // check the second line, because there might be headers accidentally in the first row
            if(isNaN(parseInt(df[1][colorCol])))
            {
                filterColor = false // don't apply normalization and heatmapfilters to it

                // try to extract color information from the string
                // check the second line, because there might be headers accidentally in the first row
                if((df[1][colorCol]+"").toLowerCase().startsWith("rgb"))
                {
                    for(let i = 0; i < df.length; i++)
                    {
                        // remove "rgb", brackets and split it into an array of [r,g,b]
                        let rgb = (df[i][colorCol]+"").substring(4,df[i][colorCol].length-1).split(",")
                        dfColors[i] = new THREE.Color(0).setRGB(rgb[0],rgb[1],rgb[2])
                    }
                }
                else if((df[1][colorCol]+"").toLowerCase().startsWith("#"))
                {
                    // hex strings are supported by three.js right away
                    for(let i = 0; i < df.length; i++)
                        dfColors[i] = new THREE.Color(df[i][colorCol])
                }
                else if((df[1][colorCol]+"").toLowerCase().startsWith("hsl"))
                {
                    for(let i = 0; i < df.length; i++)
                    {
                        // remove "hsl", brackets and split it into an array of [r,g,b]
                        let hsl = (df[i][colorCol]+"").substring(4,df[i][colorCol].length-1).split(",")
                        dfColors[i] = new THREE.Color(0).setHSL(hsl[0],hsl[1],hsl[2])
                    }
                }
                else
                {
                    // nothing worked, print a warning

                    console.warn("the column that is supposed to hold the color information (index "+colorCol+") contained an unrecognized "+
                        "string (\""+df[0][colorCol]+"\"). \"labeled\" is set to "+labeled+", \"header\" is set to "+header+" Possible formats "+
                        "for this column are numbers, hex values \"#123abc\", rgb values \"rgb(r,g,b)\", hsl values \"hsl(h,s,l)\". "+
                        "Now assuming labeled = true and restarting.")

                    // restart. Tell the Plot class to restart
                    return -1
                }

                // CASE 2 dfColors now contains colors created from RGB, # and HSL strings
                return {labelColorMap,dfColors}
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
                    dfColors[i] = parseFloat(df[i][colorCol])
                    if(!filterColor)
                        dfColors[i] = parseInt(df[i][colorCol])
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
                dfColors[i] = this.convertToHeat(color,clrMin,clrMax,hueOffset)
            }

            // CASE 3 dfColors now contains a heatmap
            return {labelColorMap,dfColors}
        }
        else
        {
            for(let i = 0;i < df.length; i++)
            {
                let color = dfColors[i]
                // store that color
                dfColors[i] = this.getColorObjectFromAnyString(color)
            }

            // CASE 4 dfColors now contains many colors, copied from the dataframe
            return {labelColorMap,dfColors}
        }
    }
    else
    {
        // colorCol is -1
        for(let i = 0; i < df.length; i++)
            dfColors[i] = this.getColorObjectFromAnyString(defaultColor)

        // CASE 5 dfColors now contains all the same color
        return {labelColorMap:{}, dfColors}
    }
}



/**
 * converts the param color to a THREE.Color object
 * @param {any} color examples: "rgb(0,0.5,1)" "hsl(0.3,0.4,0.7)" 0xff6600 "#72825a"
 */
export function getColorObjectFromAnyString(color)
{
    if(typeof(color) == "number")
        return new THREE.Color(color) // number work like this: 0xffffff = 16777215 = white. 0x000000 = 0 = black
        // numbers are supported by three.js by default

    if(typeof(color) != "number" && typeof(color) != "string")
        return console.error("getColorObjectFromAnyString expected String or Number as parameter but got "+typeof(color))

    if(color.toLowerCase().startsWith("rgb"))
    {
        // remove "rgb", brackets and split it into an array of [r,g,b]
        let rgb = color.substring(4,color.length-1).split(",")
        return new THREE.Color(0).setRGB(rgb[0],rgb[1],rgb[2])
    }
    else if(color.toLowerCase().startsWith("#"))
    {
        // hex strings are supported by three.js right away
        return new THREE.Color(color)
    }
    else if(color.toLowerCase().startsWith("hsl"))
    {
        // remove "hsl", brackets and split it into an array of [r,g,b]
        let hsl = color.substring(4,color.length-1).split(",")
        return new THREE.Color(0).setHSL(hsl[0],hsl[1],hsl[2])
    }
    return undefined
}
