/*- Processing of Uploaded Files -*/
/*- Thanks to Eric Bidelman https://www.html5rocks.com/en/tutorials/file/dndfiles/ -*/


//enable the extraction of file contents from uploaded file
document.getElementById("fileup").addEventListener("change",(e)=>fileUploaded(e))


/**
 * event listener for the type="file" input in index.html
 *
 * @param e     event object that the triggered event creates.
 */
function fileUploaded(e)
{
    let file = e.target.files[0]
    let reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (function(theFile) {
      return function(e) {
        document.getElementById("contents").innerHTML = (atob(e.target.result.split(",")[1]))
      }
    })(file)
}
