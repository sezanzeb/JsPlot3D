
var plot = new JSPLOT3D.Plot(document.getElementById("threecanvas"),"#33404c","#ffffff")

document.getElementById("formulaForm").addEventListener("submit",function(e)
{
    e.preventDefault()
    var formula = document.getElementById("formulaText").value
    plot.plotFormula(formula,true)
})


/*- Thanks to Eric Bidelman https://www.html5rocks.com/en/tutorials/file/dndfiles/ -*/
document.getElementById("submitcsv").addEventListener("click",function(e)
{
    let file = document.getElementById("fileup").files[0]
    let reader = new FileReader()
    reader.readAsDataURL(file)
    let data = ""

    reader.onload = (function(theFile)
    {
        return function(e)
        {
            let data = atob(e.target.result.split("base64,")[1])
            let x1 = document.getElementById("x1").value
            let x2 = document.getElementById("x2").value
            let x3 = document.getElementById("x3").value
            let sep = document.getElementById("sep").value
            plot.plotCsvString(data,x1,x2,x3,sep,true)
        }
    })(file)
})