"use strict"
const png = require("png-js")
const fs = require("fs")
const sizeOf = require("image-size")


// configuration
let file = "exampleImages/map.png"
let out = "../../spatial.csv"

// how many pixels and lines to skip if step > 1.
// set step to 1 to write all pixels into the csv
let step = 3




// read width and height so that the loop to create the csv knows where in the 1D-Array of the png the new line starts
let width, height
sizeOf(file, function(err, dimensions) {

    if(err != null)
        return console.error(err)

    width = dimensions.width
    height = dimensions.height

    if(width === undefined || height === undefined)
        return console.error("width (",width,") or height (",height,") are invalid")

    // csv string that is going to be written into the file
    let data = ""

    // header
    data += "long,lat,red,green,blue\n"

    let pngIndex, clr, long, lat
    png.decode(file, function(pixels)
    {
        for(let y = 0;y < height; y+=step)
        {
            for(let x = 0; x < width; x+=step)
            {
                pngIndex = (y*width+x)*4 // 4 because r g b FF
                clr = pixels[pngIndex] + "," + pixels[pngIndex+1] + "," + pixels[pngIndex+2]

                // don't create datapoints for black pixels
                if(pixels[pngIndex]+pixels[pngIndex+1]+pixels[pngIndex+2] < 100)
                    continue

                long = (29.625+x/120)
                lat = (-13.2562+y/80)
                
                // example: 40,10,255,128,10
                data += long + "," + lat + "," + clr + "\n"
            }

            // after width steps, start a new line by incrementing y
        }

        // the csv creation is finished. now write the csv file
        fs.writeFile(out, data)
    })


})















