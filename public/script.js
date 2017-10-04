
var plot = new JSPLOT3D.Plot(document.getElementById("babyloncanvas"),"#33404c","#ffffff")

document.getElementById("formulaForm").addEventListener("submit",function(e)
{
    e.preventDefault()
    var formula = document.getElementById("formulaText").value
    plot.plotFormula(formula)
})


/*- Thanks to Eric Bidelman https://www.html5rocks.com/en/tutorials/file/dndfiles/ -*/
document.getElementById("fileup").addEventListener("change",function(e)
{
    let file = e.target.files[0]
    let reader = new FileReader()
    reader.readAsDataURL(file)
    let data = ""

    reader.onload = (function(theFile)
    {
        return function(e)
        {
            let data = atob(e.target.result.split(",")[1])
            plot.plotCsvString(data,1,true)
        }
    })(file)
})