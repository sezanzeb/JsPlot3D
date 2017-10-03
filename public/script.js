
var plot = new JSPLOT3D.Plot(document.getElementById("babyloncanvas"))

document.getElementById("formulaForm").addEventListener("submit",function(e)
{
    e.preventDefault()
    var formula = document.getElementById("formulaText").value
    plot.plotFormula(formula)
})


document.getElementById("fileup").addEventListener("change",function(e)
{
    var file = e.target.files[0]
    var reader = new FileReader()
    reader.readAsDataURL(file)
    var data

    reader.onload = (function(theFile) {
    return function(e) {
        data = atob(e.target.this.result.split(",")[1])
    }
    })(file)

    plot.plotCsv(data)
})