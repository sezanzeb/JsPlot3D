/**
 * Takes care of rendering, axes, lightening, camera, scene, disposing etc.
 * @private
 */

import * as THREE from "three"
import * as COLORLIB from "./ColorLib.js"
import OrbitControls from "three-orbit-controls"


export default class SceneHelper
{

    /**
     * Constructor for the scene helper. Initializes some variables and creates the WebGL Renderer
     */
    constructor()
    {
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.recentlyUsedNormalization = null
        this.recentlyUsedDimensions = null
        this.textScale = 1/7
        this.cameraMode = 0 // default 0, which is the default orbitcontrolled perspective mode

        // inside those groups the various numbers that are displayed along the axes are stored as children
        this.xNumbers = new THREE.Group()
        this.xNumbers.name = "xNumbers"

        this.yNumbers = new THREE.Group()
        this.yNumbers.name = "yNumbers"

        this.zNumbers = new THREE.Group()
        this.zNumbers.name = "zNumbers"
    }



    /**
     * scene setup. Szene, Camera, Lighting, Axes
     * @param {object} dimensions the dimensions attribute of the Plot class. Contains xLen, yLen, zLen, xRes, zRes, xVerticesCount, zVerticesCount
     * @param {object} sceneOptions contains the attributes .backgroundColor and .axesColor. Example: {backgroundColor: "#0066ff", axesColor: "#ffffff"}
     * @param {object} cameraOptions object containing "width" and "height" of the canvas on which the plot will be drawn
     */
    createScene(dimensions, sceneOptions, cameraOptions)
    {
        let backgroundColor =0xffffff
        let axesColor = 0x000000
        
        // width and height of the canvas in px
        this.width = cameraOptions.width
        this.height = cameraOptions.height

        if(sceneOptions.backgroundColor != undefined)
            backgroundColor = sceneOptions.backgroundColor
        if(sceneOptions.axesColor != undefined)
            axesColor = sceneOptions.axesColor
        
        this.scene = new THREE.Scene()
        this.createArcCamera()

        this.setBackgroundColor(backgroundColor)

        this.createLight()

        this.createAxes(axesColor, dimensions)
    }



    /**
     * moves the camera to a good position to watch over the whole plot
     * @param {object} dimensions {xLen, yLen, zLen} 
     */
    centerCamera(dimensions)
    {
        let xLen = dimensions.xLen
        let yLen = dimensions.yLen
        let zLen = dimensions.zLen

        // 80 is the default camera.fov value. A less perspectivic view can be achieved using a smaller value, but it has to be moved farther away
        let zoom = 80/this.camera.fov

        if(this.camera.type === "OrthographicCamera")
            zoom = 1

        let x, y, z
        if(this.cameraMode == 0)
        {
            x = zoom*(xLen/2)
            y = zoom*(Math.max(zLen, yLen))
            z = zoom*(zLen+xLen)
        }
        else if(this.cameraMode == 1)
        {
            // topCamera
            x = xLen/2
            y = Math.max(xLen,zLen)*2
            z = zLen/2
            this.camera.initial_y = y
        }

        this.camera.position.set(x, y, z)
        this.cameraControls.target.set(xLen/2, yLen/2, zLen/2)
        this.camera.lookAt(this.cameraControls.target)
        this.render()
    }



    /**
     * changes the mode of the camera
     * @param {number} mode either JSPLO3D.TOPCAMERA or JSPLOT3D.DEFAULTCAMERA
     */
    changeCameraMode(mode)
    {
        // already using that mode? Then just return and do nothing
        if(this.cameraMode == mode)
            return

        this.cameraControls.dispose()
        // TODO will this cause a memory leak because of cameras not being removed?
        // Can't dispose camera. workaround would be to keep the cameras in the storage and switch them
        if(mode == 1)
        {
            // orthographic camera looking from the top
            this.createTopCamera()
            this.createAxes(this.axesColor, this.dimensions, this.normalization)
        }
        else
        {
            // unkown or 0: default
            this.createArcCamera()
        }
        this.cameraMode = mode
        this.render()
    }



    createTopCamera()
    {
        let width = this.width
        let height = this.height
        let near = 0 // when objects start to disappear at zoom-in
        let far = 50 // when objects start to disappear at zoom-out
        let a = Math.min(width, height)
        let camera = new THREE.OrthographicCamera(-width/a, width/a, height/a,-height/a, near, far)

        // helps to control the sprite size to be roughly the same as in the default perspective mode camera
        // camera.scale.set(0.5, 0.5, 0.5)

        let controls = new (OrbitControls(THREE))(camera, this.renderer.domElement)
        controls.enableKeys = false

        // the point of this is, that i can disable this by overwriting it
        // when doing animations no need to use the event listener anymore
        this.onChangeCamera = this.render
        controls.addEventListener("change", ()=>{
            // change y position, so that the sprite size stays the same. Without the following
            // line the sprites maintain the same size on the screen in px despite zoom factor
            this.camera.position.y = this.camera.initial_y/this.camera.zoom
            this.render()
        })

        controls.enableDamping = true
        controls.dampingFactor = 0.25
        controls.enableZoom = true
        controls.enableRotate = false
        // controls.maxDistance = 5
        // controls.minDistance = 0.3

        this.camera = camera
        this.cameraControls = controls
    }



    /** 
     * Creates the camera
     */
    createArcCamera()
    {
        // the cameras position is set in centerCamera, which is called on setDimensions and during the constructor in JsPlot3D.js
        let width = this.width
        let height = this.height
        let viewAngle = 40
        let aspect = width / height
        let near = 0.05 // when objects start to disappear at zoom-in
        let far = 50 // when objects start to disappear at zoom-out
        let camera = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)

        let controls = new (OrbitControls(THREE))(camera, this.renderer.domElement)
        controls.enableKeys = false

        // the point of this is, that i can disable this by overwriting it
        // when doing animations no need to use the event listener anymore
        this.onChangeCamera = this.render
        controls.addEventListener("change", ()=>this.render())

        controls.enableDamping = true
        controls.dampingFactor = 0.25
        controls.enableZoom = true
        controls.rotateSpeed = 0.3
        controls.enableRotate = true
        // controls.maxDistance = 5
        // controls.minDistance = 0.3

        this.camera = camera
        this.cameraControls = controls
    }



    /**
     * takes care of creating the light
     */
    createLight()
    {
        // set a directional light
        let color1 = 0xff9933
        let color2 = 0x0033ff

        let directionalLight1 = new THREE.DirectionalLight(color1, 0.4)
        directionalLight1.position.y = 1
        directionalLight1.name = "lightFromTop"
        this.scene.add(directionalLight1)

        let directionalLight2 = new THREE.DirectionalLight(color2, 0.4)
        directionalLight2.position.y = -1
        directionalLight2.name = "lightFromBottom"
        this.scene.add(directionalLight2)
    }



    /**
     * removes the axes. They can be recreated using createAxes(color)
     */
    removeAxes()
    {
        this.disposeMesh(this.axes)
        this.disposeMesh(this.gridHelper)
        this.axes = null
        this.gridHelper = null
    }



    /**
     * creates a THREE.Sprite object that has a canvas as texture that was filled with text. uses createLetterTexture to create the texture.
     * @param {string} letter examples: "a", "lksdfj", 0.546, 91734917, "78n6"
     * @param {Vector3} position Vector3 object {x, y, z}
     * @param {string} align "center", "left" or "right"
     * @param {number} scale scaling of the letter, default is 1
     */
    placeLetter(letter, position, align="center", scale=1)
    {
        letter = ""+letter
        let canvasToTexture = this.createLetterTexture(letter, align)
        let geometry = new THREE.Geometry()

        // I'm using Points and PointsMaterial instead of SpriteMaterial so that sizeAttenuation: false can be used
        // Sprite and SpriteMaterial zooms the sprites when zooming in
        geometry.vertices.push(new THREE.Vector3(0, 0, 0)) // 0, 0, 0 so that I can move it around using the position.set()
        let textureToSprite = new THREE.Points(geometry, new THREE.PointsMaterial({
            map: canvasToTexture,
            depthTest: true,
            // depthWrite: false,
            sizeAttenuation: false,
            size: canvasToTexture.image.width * this.textScale * scale,
            transparent: true,
        }))
        textureToSprite.position.set(position.x, position.y, position.z)

        // make sure it renders on the top
        textureToSprite.renderOrder = Number.MAX_SAFE_INTEGER

        textureToSprite.name = "sprite_"+letter

        // transform scale
        // textureToSprite.scale.set(size*Math.pow(2, letter.length),2*size)
        // textureToSprite.scale.set(size,size)


        return textureToSprite
    }



    /**
     * returns a THREE.Material object that contains text as texture
     * @param {string} letter examples: "a", "lksdfj", 0.546, 91734917, "78n6"
     * @param {string} align "center", "right" or "left"
     */
    createLetterTexture(letter, align)
    {
        let fontSize = 80

        letter = ""+letter
        // write text to a canvas
        let textCanvas = document.createElement("canvas")
        // textCanvas.height = 128

        // textCanvas.width = letter.length * 64
        // the texture size has to be a power of two for each dimension
        // letter.length -> width. 2 -> 2, 3 -> 4, 4 -> 4, 5 -> 8, 6 -> 8, 7 -> 8, etc.
        textCanvas.width = Math.pow(2, (Math.log2(letter.length)|0)+2)*64
        textCanvas.height = textCanvas.width // 128 // power of 2 and greater than 80 // will be scaled and distored if not quadratic

        // prepare the textwriting
        let context2d = textCanvas.getContext("2d")
        
        // IMPRTANT: when editing this, keep in mind that light text produces slight black outlines (because of the nature of THREE.js)
        // the same goes for light outlines drawn on the canvas. They also have some slightly black pixels around them. Even white shadows have some darkish fragments.
        // that means: try to hide those slight black pixels with a bold black outline. If the background is dark, they can't be seen anyway luckily.

        // make sure the text is always readable
        let axL = this.axesColor.getHSL().l
        context2d.fillStyle = "#"+this.axesColor.getHexString() // text color is always the axesColor

        // now try to find the best outline color (in case of black text on white background don't draw one)
        if(axL > 0.4)
        {
            // if axesColor is light, use black outlines
            // always use them, even when the background is black, because white might be hard to make out
            // on top of heatmaps (yellow and turqoise are heatmap colors and very light)

            // outline
            context2d.strokeStyle = "rgba(0,0,0,0.8)"
            context2d.miterLimit = 1 // curved outline edges
            context2d.lineWidth = 10
        }
        else
        {
            let bgL = this.backgroundColor.getHSL().l
            if(bgL < 0.4)
            {
                // if axes are dark and background is dark (that means black outlines would fail)
                // use white outlines

                // outline
                context2d.strokeStyle = "rgba(255,255,255,0.8)"
                context2d.miterLimit = 1 // curved outline edges
                context2d.lineWidth = 10
            }
            else
            {
                // if axesColor is dark and background is light, draw without outlines
            }
        }
        
        // write it centered
        context2d.font = "Bold "+fontSize+"px sans-serif"
        context2d.textAlign = align
        context2d.strokeText(letter, textCanvas.width/2, textCanvas.height/2 + fontSize/4) // write outline
        context2d.fillText(letter, textCanvas.width/2, textCanvas.height/2 + fontSize/4) // write text

        // create a texture from the canvas
        let canvasToTexture = new THREE.CanvasTexture(textCanvas)

        // canvasToTexture.needsUpdate = true // canvasTexture has this true by default

        return canvasToTexture
    }



    /**
     * updates the text shown on a sprite (creates a new lettertexture using createLetterTexture and updates a THREE.Mesh/Sprite/etc.)
     * @param {object} sprite sprite object that contains the text as texture (THREE.Sprite)
     * @param {string} letter new text to be displayed on the sprite
     * @param {string} align "center", "right" or "left"
     */
    updateLetterTextureOnSprite(sprite, letter, align)
    {
        letter = ""+letter
        sprite.material.map.dispose()
        sprite.material.map = this.createLetterTexture(letter, align)
        sprite.material.size = sprite.material.map.image.width * this.textScale
        sprite.material.needsUpdate = true
    }



    /**
     * creates numbers according to the parameters. They are going to be displayed along the axis.
     * If the number object is already defined, only the texture and position will be updated for performance reasons
     * 
     * This function can create the numbers for all three axes and basically even more than that,
     * it's just a matter of how you define the position lamda function in the parameters
     * 
     * @param {number} numberCount how many numbers to display along the axis
     * @param {number} axisLen length of the axis
     * @param {number} axisNumber JSPLOT3D.XAXIS, JSPLOT3D.YAXIS or JSPLOT3D.ZAXIS
     * @param {number} min the vlaue of the lowest datapoint (as available in the dataframe)
     * @param {number} max the value of the highest datapoint (as available in the dataframe)
     * @return {object} with numbers populated group
     */
    updateNumbersAlongAxis(numberDensity, axisLen, axisNumber, min, max)
    {

        //// Selecting parameters

        // get the group that contains the numbers according to axisNumber
        let numbersGroupName = ([
            "xNumbers",
            "yNumbers",
            "zNumbers"
        ])[axisNumber-1]
        let numbersGroup = this[numbersGroupName]

        // select the function for updating the number position
        let offset2 = -0.075
        let position = ([
            (value)=>{return new THREE.Vector3(value, -offset2, offset2)}, // x-Axis
            (value)=>{return new THREE.Vector3(offset2, value, offset2)}, // y-Axis
            (value)=>{return new THREE.Vector3(offset2, -offset2, value)}  // z-Axis
        ])[axisNumber-1]

        // align of the text. the goal is to nicely align it with the axes
        let align = ([
            "center", // x-Axis
            "right", // y-Axis
            "right"  // z-Axis
        ])[axisNumber-1]

        let numberCount = (numberDensity*axisLen)|0



        // load the numbers that have already been created at some point:
        let children = numbersGroup.children
        // the numbers are stored as children inside a group. one group for each axes. (the groups are stored inside this.axes.children)
        // to access the children inside the group, use this index:
        let index = 0
        // x is the value in terms of the position in the actual 3D space on the axis
        // step indicates how far away the numbers are in terms of the actual 3D space
        let step = axisLen/numberCount
        
        for(let x = step; x <= axisLen; x += step)
        {
            // the higher the index the higher the number

            // this is the number that is going to be displayed
            // max-min results in the range of numbers. divide it by the numberCount to get the step-size for each number
            // multiply it by index+1 to get this stepsize*2. example: min = 0.5, max = 1, numberCount = 3
            // 0.5/3*1+0.5 = 0.666       0.5/3*2+0.5 = 0.833       0.5/3*3+0.5 = 1
            // with 0.5 being left out because it would be where all three axis meet and there is not enough space for numbers
            let number = (max-min)/numberCount*(index+1) + min

            // if the number didn't change, don't do anything
            if(children[index] != undefined && children[index].originalNumber === number)
            {
                continue
            }

            let text = number.toPrecision(3)
            let pos = position(x)
            if(children.length - 1 < index) // if children are not yet created
            {
                // not yet defined: create from scratch
                let textObject = this.placeLetter(text, pos, align)
                textObject.originalNumber = number
                numbersGroup.add(textObject)
            }
            else
            {
                // already defined: update texture and position
                this.updateLetterTextureOnSprite(children[index], text, align)
                children[index].originalNumber = number
                children[index].position.set(pos.x, pos.y, pos.z)
            }

            // no need to check if there are numbers left over as children, because the amount of numbers (numberCount) only changes
            // when updating the dimensions, and when that happens the whole axes gets disposed
            index ++
        }
        
        this.axes.add(numbersGroup)

        return numbersGroup
    }




    /**
     * If axesare available, call createAxes to recreate them. If not, do nothing
     * @param {object} dimensions {xLen, yLen, zLen} 
     * @param {object} normalization {maxX1, maxX2, maxX3} 
     */
    updateAxesSize(dimensions, normalization)
    {
        if(this.axes === null)
            return
        
        this.disposeAllAxesNumbers()
        this.createAxes(this.axesColor,dimensions,normalization)
    }



    /**
     * removes all the numbers from all three axes
     */
    disposeAllAxesNumbers()
    {
        // not that xNumbers, yNumbers and zNumbers are set in JsPlot3D.js when updateNumbersAlongAxis is called
        if(this.axes !== null)
        {
            this.disposeMesh(this.xNumbers)
            this.disposeMesh(this.yNumbers)
            this.disposeMesh(this.zNumbers)

            this.xNumbers = new THREE.Group()
            this.xNumbers.name = "xNumbers"

            this.yNumbers = new THREE.Group()
            this.yNumbers.name = "yNumbers"

            this.zNumbers = new THREE.Group()
            this.zNumbers.name = "zNumbers"
        }
    }

    

    /**
     * creates the lines that point into the three x, y and z directions, adds the arrows at the tips, adds "x" "y" and "z" labels.
     * @private
     * @param {string} color     hex string of the axes color. default black #000000
     * @param {object} dimensions {xLen, yLen, zLen} 
     * @param {object} normalization {maxX1, maxX2, maxX3} 
     */
    createAxes(color, dimensions, normalization)
    {
        this.dimensions = dimensions
        this.normalization = normalization


        this.disposeMesh(this.axes)

        let xLen = dimensions.xLen
        let yLen = dimensions.yLen
        let zLen = dimensions.zLen

        let showx1 = dimensions.xLen != 0 && dimensions.xRes != 0
        let showx2 = this.cameraMode != 1 && dimensions.yRes != 0
        let showx3 = dimensions.zLen != 0 && dimensions.zRes != 0

        let axes = new THREE.Group()
        let percentage = 1.1 // how long the axes are to xLen, yLen and zLen



        // check wether color is a THREE.Color object or not
        let colorObject
        if(typeof(color) == "object" && color.r != undefined)
        {
            colorObject = color // Three.Color Object
        }
        else
        {
            colorObject = COLORLIB.getColorObjectFromAnyString(color)
        }

        // if creating the color was successful
        if(colorObject != undefined)
        {
            color = colorObject
        }
        else
        {
            color = new THREE.Color(0)
            console.error("unrecognized color",color)
        }



        this.axesColor = colorObject

        // lines that point into the dimensions
        let axesWireGeom = new THREE.Geometry()
        let cent = new THREE.Vector3(0,0,0)
        let xend = new THREE.Vector3(xLen*percentage,0,0)
        let yend = new THREE.Vector3(0, yLen*percentage,0)
        let zend = new THREE.Vector3(0,0, zLen*percentage)
        axesWireGeom.vertices.push(cent) // 0
        axesWireGeom.vertices.push(xend) // 1
        axesWireGeom.vertices.push(yend) //2
        axesWireGeom.vertices.push(zend) //3
        axesWireGeom.faces.push(new THREE.Face3(0,0,1))
        axesWireGeom.faces.push(new THREE.Face3(0,0,2))
        axesWireGeom.faces.push(new THREE.Face3(0,0,3))
        // wireframe and color those paths
        let axesWireMat = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            side: THREE.DoubleSide
        })
        let axesWire = new THREE.Mesh(axesWireGeom, axesWireMat)
        axesWire.name = "axesWire"
        axes.add(axesWire)


        // arrows that sit at the end of the lines
        let arrowMat = new THREE.MeshBasicMaterial({
            color: color
        })
        let arrowGeom = new THREE.ConeGeometry(0.02,0.066,12)

        if(showx1) {
            let arrowMesh1 = new THREE.Mesh(arrowGeom, arrowMat)
            arrowMesh1.rotateZ(-Math.PI/2)
            arrowMesh1.position.set(xLen*percentage,0,0)
            arrowMesh1.name = "xArrow"
            axes.add(arrowMesh1)
        }
        
        if(showx2) {
            let arrowMesh2 = new THREE.Mesh(arrowGeom, arrowMat)
            arrowMesh2.position.set(0, yLen*percentage,0)
            arrowMesh2.name = "yArrow"
            axes.add(arrowMesh2)
        }
        
        if(showx3) {
            let arrowMesh3 = new THREE.Mesh(arrowGeom, arrowMat)
            arrowMesh3.rotateX(Math.PI/2)
            arrowMesh3.position.set(0,0, zLen*percentage)
            arrowMesh3.name = "zArrow"
            axes.add(arrowMesh3)
        }

        // text indicating the dimension name
        let offset = 0.1

        if(showx1) {
            let xLetter
            xLetter = this.placeLetter("x", new THREE.Vector3(xLen*percentage+offset, 0, 0), "center", 1.3)
            axes.add(xLetter)
        }

        if(showx2) {
            let yLetter
            yLetter = this.placeLetter("y", new THREE.Vector3(0, yLen*percentage+offset, 0), "center", 1.3)
            axes.add(yLetter)
        }

        if(showx3) {
            let zLetter
            zLetter = this.placeLetter("z", new THREE.Vector3(0, 0, zLen*percentage+offset), "center", 1.3)
            axes.add(zLetter)
        }



        // create a new gridHelper that divides the 3Dspace into 9 pieces
        let gridHelper1 = new THREE.GridHelper(1, 3, colorObject, colorObject)
        gridHelper1.geometry.translate(0.5,0,0.5)

        if(yLen == 0)
            gridHelper1.geometry.translate(0,-0.1,0)

        gridHelper1.geometry.scale(dimensions.xLen,1,dimensions.zLen)
        // appearance
        gridHelper1.material.transparent = true
        gridHelper1.material.opacity = 0.2
        axes.add(gridHelper1)

        // gridhelper on the x-y and z-y planes. But they don't actually look that good I think
        /*let gridHelper2 = new THREE.GridHelper(1, 1, colorObject, colorObject)
        gridHelper2.geometry.translate(0.5,0,0.5)
        gridHelper2.geometry.scale(dimensions.xLen,1,dimensions.yLen)
        gridHelper2.geometry.rotateX(-Math.PI/2)
        // appearance
        gridHelper2.material.transparent = true
        gridHelper2.material.opacity = 0.1
        axes.add(gridHelper2)

        let gridHelper3 = new THREE.GridHelper(1, 1, colorObject, colorObject)
        gridHelper3.geometry.translate(0.5,0,0.5)
        gridHelper3.geometry.scale(dimensions.yLen,1,dimensions.zLen)
        gridHelper3.geometry.rotateZ(Math.PI/2)
        // appearance
        gridHelper3.material.transparent = true
        gridHelper3.material.opacity = 0.1
        axes.add(gridHelper3)*/


        // updateAxesNumbers relies on this.axes, so make sure this is assigned before it
        this.axes = axes

        // normalization might be undefined when there is no plot yet to show
        // if(normalization != undefined)
        //    this.updateAxesNumbers(dimensions, normalization, numberDensity)

        axes.name = "axesGroup"

        axes.dimensions = dimensions
        axes.normalization = normalization

        // add the axes group to the scene and store it locally in the object
        this.scene.add(axes)
    }
    
    
    
    /**
     * frees memory and removes the mesh (by making it available for the garbage collegtor)
     */
    disposeMesh(mesh)
    {   
        
        if(mesh)
        {
            if(mesh.geometry)
                mesh.geometry.dispose()

            // disppose material
            if(mesh.material)
            {
                if(!mesh.material.length && mesh.material)
                    mesh.material.dispose()
                    
                if(!isNaN(mesh.material.length))
                {
                    // material is an array
                    for(let i = 0;i < mesh.material.length; i++)
                        mesh.material[i].dispose()
                }

                // for sprites material.map.dispose() seems to be important
            }

            if(mesh.texture)
                mesh.texture.dispose()

            // recursively clear the children
            for(let i = 0;i < mesh.children.length; i++)
                this.disposeMesh(mesh.children[i])
                
            if(mesh.parent !== null)
                mesh.parent.remove(mesh)
                
            mesh.remove()
        }
    }



    /**
     * sometimes it renders sometimes it does not (static images)
     * super problematic. Make sure it gets rendered by using some timeouted renders
     */
    makeSureItRenders(animationFunc)
    {
        // if animated, don't render it here. In callAnimation it's going to render
        if(animationFunc === null)
        {
            for(let i = 0;i < 5; i++)
                window.setTimeout(()=>this.render(),100+i*33)
            for(let i = 0;i < 5; i++)
                window.setTimeout(()=>this.render(),(100+5*33)+i*66)
        }
    }



    /**
     * changes the background color and triggers a rerender. For the axes to update their shadows make sure to call plot.setAxesColor again
     * @param {string} color
     */
    setBackgroundColor(color)
    {
        let colorObject = COLORLIB.getColorObjectFromAnyString(color)
        
        // for later use. shadows of the text letters that are drawn on canvases
        this.backgroundColor = colorObject

        if(colorObject != undefined)
            this.renderer.setClearColor(COLORLIB.getColorObjectFromAnyString(color))
        else
            this.renderer.setClearColor(color)

        this.render()
    }
    
    
    
    /**
     * updates what is visible on the screen.
     */
    render()
    {
        this.renderer.render(this.scene, this.camera)
    }
}