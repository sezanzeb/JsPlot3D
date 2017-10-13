var plot = new JSPLOT3D.Plot(document.getElementById("threecanvas"), {
    backgroundColor:"#33404c",
    axesColor:"#ffffff"
})
plot.createLegend(document.getElementById("Legend"))
var decodedData = ""
var cached = false
var name = ""

//plot the formula
document.getElementById("formulaForm").addEventListener("submit",function(e)
{
    e.preventDefault()
    var formula = document.getElementById("formulaText").value
    plot.plotFormula(formula, "scatterplot")
})

//write down that the file in the cache is not up to date anymore
document.getElementById("fileup").addEventListener("change",function(e)
{
    cached = false
})

//plot the csv file
document.getElementById("submitcsv").addEventListener("click",function(e)
{
    //read file only if it has changed (event on fileup "change")
    if(!cached)
    {
        let reader = new FileReader()
        let file = document.getElementById("fileup").files[0]
        reader.readAsDataURL(file)
        reader.onload = function(e)
        {
            //unfortunatelly the Base64 decoding can take long
            if(!cached)
            {
                decodedData = atob(e.target.result.split("base64,")[1])
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

//calling it plot() throws an error
function plotcsv()
{
    let x1 = document.getElementById("x1").value
    let x2 = document.getElementById("x2").value
    let x3 = document.getElementById("x3").value
    let clr = document.getElementById("clr").value
    plot.plotCsvString(decodedData,x1,x2,x3,{
        colorCol: clr,
        normalizeX1: true,
        normalizeX2: true,
        normalizeX3: true,
        mode: "scatterplot",
        title: name,
        fraction: 1,
        labeled: false,
        hueOffset: 0.3
    })
}
