/* live example */


var plot = new JSPLOT3D.Plot(document.getElementById("threecanvas"), {
    backgroundColor:"#33404c",
    axesColor:"#ffffff"
})
plot.createLegend(document.getElementById("Legend"))

var decodedData = ""
var cached = false

main()




/**
 * returns the value of a settings input
 * @param {string} id id of the input element that contains a value
 */
function getVal(id)
{
    var elem = document.getElementById(id)

    var value = elem.value
    if(value == "true")
        value = true
    if(value == "false")
        value = false
    if(value == "")
        value = undefined

    return value
}



/**
 * returns a json object that contains all the settings. compatible to JsPlot3D
 */
function getOptions()
{
    var name = ""
    var mode = "scatterplot"

    var mode = getVal("mode")
    var normalizeX1 = getVal("normalizeX1")
    var normalizeX2 = getVal("normalizeX2")
    var normalizeX3 = getVal("normalizeX3")
    var xRes = getVal("xRes")
    var zRes = getVal("zRes")
    var barchartPadding = getVal("barchartPadding")
    var barSizeThreshold = getVal("barSizeThreshold")
    var defaultColor = getVal("defaultColor")
    var hueOffset = getVal("hueOffset")
    var title = getVal("title")
    var x1title = getVal("x1title")
    var x2title = getVal("x2title")
    var x3title = getVal("x3title")
    var fraction = getVal("fraction")
    var keepOldPlot = getVal("keepOldPlot")
    var colorCol = getVal("colorCol")
    var dataPointSize = getVal("dataPointSize")
    var header = getVal("header")
    var separator = getVal("separator")
    
    return {
        mode,normalizeX1,normalizeX2,
        normalizeX3,xRes,zRes,barchartPadding,
        barSizeThreshold,defaultColor,
        hueOffset,title,x1title,x2title,
        x3title,fraction,keepOldPlot,colorCol,
        dataPointSize,header,separator
    }
}



/**
 * plots a .csv file using the contents of the decodedData variable
 */
//calling it plot() throws an error
function plotcsv()
{
    let x1 = document.getElementById("x1").value
    let x2 = document.getElementById("x2").value
    let x3 = document.getElementById("x3").value
    plot.plotCsvString(decodedData,x1,x2,x3,getOptions())
}



/**
 * entrypoint
 */
function main()
{
    //plot the formula
    document.getElementById("formulaForm").addEventListener("submit",function(e)
    {
        e.preventDefault()
        var formula = document.getElementById("formulaText").value
        plot.plotFormula(formula, getOptions())
    })



    //add the filename to the button
    document.getElementById("fileup").addEventListener("change",function(e)
    {
        cached = false
        document.getElementById("fileuplabel").innerHTML = e.target.files[0].name
    })



    //plot the csv file
    document.getElementById("submitcsv").addEventListener("click",function(e)
    {
        //read file only if it has changed (event on fileup "change")
        if(!cached)
        {
            let reader = new FileReader()
            let file = document.getElementById("fileup").files[0]
            reader.readAsText(file)
            reader.onload = function(e)
            {
                //unfortunatelly the Base64 decoding can take long
                if(!cached)
                {
                    decodedData =e.target.result
                    name = file.name
                    cached = true
                }
                else
                {
                    console.log("using cached data")
                }

                plotcsv()
            }
        }
        else
        {
            plotcsv()
        }
    })
}
