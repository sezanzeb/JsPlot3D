"use strict"
const png = require("png-js")
const fs = require("fs")
const sizeOf = require("image-size")

// configuration
let file
let out

for(let i = 0;i < process.argv.length; i++)
{
    let key = process.argv[i]
    if(key === "-f")
    {
        i++
        file = process.argv[i]
    }

    if(key === "-o")
    {
        i++
        out = process.argv[i]
    }
}

// -f has to be specified
if(file === undefined)
{
    console.error("you didn't use the -f argument")
    console.error("node pngToCsv.js -f \"path-to-image\" -o \"output-optional\"")
    process.exit()
}

// if no output was specified using the -o argument, remove the filetype and append .csv
if(out === undefined)
{
    let i = file.lastIndexOf(".")
    if(i === -1)
        i = file.length
    out = file.substring(0, i)+".csv"
    console.log("output:", out)
}

// how many pixels and lines to skip if step > 1.
// set step to 1 to write all pixels into the csv
let step = 1

// read width and height so that the loop to create the csv knows where in the 1D-Array of the png the new line starts
let width, height


function read(pixels, x, y)
{
    let pngIndex = (y*width+x)*4 // 4 because r g b FF
    let clr = pixels[pngIndex] + "," + pixels[pngIndex+1] + "," + pixels[pngIndex+2]

    // don't create datapoints for black pixels
    /*if(pixels[pngIndex]+pixels[pngIndex+1]+pixels[pngIndex+2] < 100)
        return false*/

    /*long = (29.625+x/120)
    lat = (-13.2562+y/80)*/
    let long = x
    let lat = y
    
    // example: 40,10,255,128,10
    let data = long + "," + lat + "," + clr + "\n"
    return data
}



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

    png.decode(file, function(pixels)
    {
        for(let y = 0;y < height; y+=step)
        {
            let x = 0
            for(; x < width-1; x+=step)
            {
                data += read(pixels, x, y)
            }


            // by parsing the next line vice versa (start at the rightmost pixel and proceed to the left)
            // the plot can be shown using the lineplot mode. otherwise lines would zick zack between the lines

            y += step
            if(!(y < height))
                break

            for(; x > 0; x-=step)
            {
                data += read(pixels, x, y)
            }
            // after width steps, start a new line by incrementing y
        }

        // the csv creation is finished. now write the csv file
        fs.writeFile(out, data)
    })


})















