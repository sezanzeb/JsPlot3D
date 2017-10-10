var plot = new JSPLOT3D.Plot(document.getElementById("threecanvas"),"#33404c","#ffffff")
var decodedData = ""
var cached = false

//plot the formula
document.getElementById("formulaForm").addEventListener("submit",function(e)
{
    e.preventDefault()
    var formula = document.getElementById("formulaText").value
    plot.plotFormula(formula)
})

//write down that the file in the cache is not up to date anymore
document.getElementById("fileup").addEventListener("change",function(e)
{
    cached = false
})

//plot the csv file
document.getElementById("submitcsv").addEventListener("click",function(e)
{
    //read file only if it has changed
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
    let sep = document.getElementById("sep").value
    plot.plotCsvString(decodedData,x1,x2,x3,{
        separator: sep,
        colorCol: clr,
        scatterplot: true,
        normalize: true,
        title: "",
        fraction: 1,
        labeled: false
    })
}