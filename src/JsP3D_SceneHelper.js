const THREE = require("three")
const OrbitControls = require('three-orbit-controls')(THREE)
const COLORLIB = require("./JsP3D_ColorLib.js")

/**
 * Takes care of rendering, axes, lightening, camera, scene, disposing etc.
 * @private
 */
export default class JsP3D_SceneHelper
{

    /**
     * Constructor for the scene helper. Initializes some variables and creates the WebGL Renderer
     */
    constructor()
    {
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.recentlyUsedNormalization = undefined
        this.recentlyUsedDimensions = undefined
    }



    /**
     * scene setup. Szene, Camera, Lighting, Axes
     * @param {*} dimensions 
     * @param {*} sceneOptions 
     * @param {*} cameraOptions 
     */
    createScene(dimensions, sceneOptions, cameraOptions)
    {
        if(this.renderer == undefined)
            return console.error("createScene has to be called after setupRendering. this.renderer is undefined")

        let backgroundColor = 0xffffff
        let axesColor = 0x000000

        if(sceneOptions.backgroundColor != undefined)
            backgroundColor = sceneOptions.backgroundColor
        if(sceneOptions.axesColor != undefined)
            axesColor = sceneOptions.axesColor
        
        this.setBackgroundColor(backgroundColor)

        this.scene = new THREE.Scene()
        this.createLight()
        this.createAxes(axesColor, dimensions)
        this.createArcCamera(cameraOptions.width, cameraOptions.height)
    }



    /**
     * moves the camera to pos (1st parameter) and makes it look at target (2nd parameter)
     * @param {number[]} pos THREE.Vector3 camera position {x, y, z}
     * @param {number[]} target THREE.Vector3 camera target. The center of what can be seen on the screen {x, y, z}
     */
    moveCamera(pos, target)
    {
        this.camera.position.set(pos.x, pos.y, pos.z)
        this.cameraControls.target.set(target.x, target.y, target.z)
        this.camera.lookAt(this.cameraControls.target)
    }



    /**
     * moves the camera to a good position to watch over the whole plot
     * @param {object} dimensions {xLen, yLen, zLen} 
     */
    centerCamera(dimensions)
    {
        //camera already created? It might be called by setDimensions in the constructor before the camera creation
        if(this.camera == undefined)
            return

        let xLen = dimensions.xLen
        let yLen = dimensions.yLen
        let zLen = dimensions.zLen

        // 80 is the default camera.fov value. A less perspectivic view can be achieved using a smaller value, but it has to be moved farther away
        let zoom = 80/this.camera.fov

        this.camera.position.set(zoom*(xLen/2), zoom*(Math.max(zLen, yLen)), zoom*(zLen+xLen))
        this.cameraControls.target.set(xLen/2, yLen/2, zLen/2)
        this.camera.lookAt(this.cameraControls.target)
    }


    /** Creates the camera
     * @private
     */
    createArcCamera(width, height)
    {

        let viewAngle = 40
        let aspect = width / height
        let near = 0.05 // when objects start to disappear at zoom-in
        let far = 20 // when objects start to disappear at zoom-out
        let camera = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)
        //let a = Math.min(width, height)
        //let camera = new THREE.OrthographicCamera(-width/a, width/a, height/a,-height/a, near, far)

        let controls = new OrbitControls(camera, this.renderer.domElement)
        controls.enableKeys = false
        controls.target.set(0.5,0.5,0.5)

        // the point of this is, that i can disable this by overwriting it
        // when doing animations no need to use the event listener anymore
        this.onChangeCamera = function()
        {
            this.render()
        }
        controls.addEventListener("change", ()=>this.render())

        controls.enableDamping = true
        controls.dampingFactor = 0.25
        controls.enableZoom = true
        controls.rotateSpeed = 0.3
        //controls.maxDistance = 5
        //controls.minDistance = 0.3

        // start looking at the target initially
        camera.lookAt(controls.target)

        this.camera = camera
        this.cameraControls = controls
    }



    /**
     * takes care of creating the light
     * @private
     */
    createLight()
    {
        // set a directional light
        let color1 = 0xff9933
        let color2 = 0x0033ff

        let directionalLight1 = new THREE.DirectionalLight(color1, 0.4)
        directionalLight1.position.y = 1;
        directionalLight1.name = "lightFromTop"
        this.scene.add(directionalLight1)

        let directionalLight2 = new THREE.DirectionalLight(color2, 0.4)
        directionalLight2.position.y = -1;
        directionalLight2.name = "lightFromBottom"
        this.scene.add(directionalLight2)
    }



    /**
     * removes the axes. They can be recreated using createAxes(color)
     */
    removeAxes()
    {
        this.disposeMesh(this.axes)
        this.axes = undefined
    }



    /**
     * creates a THREE.Sprite object that has a canvas as texture that was filled with text. uses createLetterTexture to create the texture.
     * @param {string} letter examples: "a", "lksdfj", 0.546, 91734917, "78n6"
     * @param {string} textColor examples: "#fff000", "#987a63"
     * @param {Vector3} position Vector3 object {x, y, z}
     */
    placeLetter(letter, textColor, position)
    {
        letter = ""+letter
        let canvasToTexture = this.createLetterTexture(letter, textColor)
        let geometry = new THREE.Geometry()

        // I'm using Points and PointsMaterial instead of SpriteMaterial so that sizeAttenuation can be used
        geometry.vertices.push(new THREE.Vector3(0, 0, 0)) // 0, 0, 0 so that I can move it around using the position.set()
        let textureToSprite = new THREE.Points(geometry, new THREE.PointsMaterial({
            map: canvasToTexture,
            depthTest: false,
            //depthWrite: false,
            sizeAttenuation: false,
            size: canvasToTexture.image.width/6,
            transparent: true,
        }))
        textureToSprite.position.set(position.x, position.y, position.z)

        //make sure it renders on the top
        textureToSprite.renderOrder = Number.MAX_SAFE_INTEGER

        textureToSprite.name = "sprite_"+letter

        // transform scale
        //textureToSprite.scale.set(size*Math.pow(2, letter.length),2*size)
        //textureToSprite.scale.set(size,size)


        return textureToSprite
    }



    /**
     * returns a THREE.Material object that contains text as texture
     * @param {string} letter examples: "a", "lksdfj", 0.546, 91734917, "78n6"
     * @param {string} textColor examples: "#fff000", "#987a63"
     */
    createLetterTexture(letter, textColor)
    {
        letter = ""+letter
        // write text to a canvas
        let textCanvas = document.createElement('canvas')
        //textCanvas.height = 128

        //textCanvas.width = letter.length * 64
        // the texture size has to be a power of two for each dimension
        // letter.length -> width. 2 -> 2, 3 -> 4, 4 -> 4, 5 -> 8, 6 -> 8, 7 -> 8, etc.
        textCanvas.width = Math.pow(2, parseInt(Math.log2(letter.length))+1)*64
        textCanvas.height = textCanvas.width

        // prepare the textwriting
        let context2d = textCanvas.getContext('2d')
        let fontSize = 80
        context2d.font = "Bold "+fontSize+"px sans-serif"
        context2d.fillStyle = textColor // textclr
        context2d.shadowBlur = 8 // use the background color as shadow:
        context2d.shadowColor = "rgba(" + this.backgroundColor.r*255 + "," + this.backgroundColor.g*255 + "," + this.backgroundColor.b*255 + "," + "1" + ")"
        
        // write it centered
        let textwidth = letter.length*64 //this would be the approach for a monospace fonts, but it somewhat approximates other fonts aswell
        
        // write
        context2d.fillText(letter, (textCanvas.width - textwidth)/2, textCanvas.height/2) // write

        // create a texture from the canvas
        let canvasToTexture = new THREE.Texture(textCanvas)

        canvasToTexture.needsUpdate = true

        return canvasToTexture
    }



    /**
     * updates the text shown on a sprite (creates a new lettertexture using createLetterTexture and updates a THREE.Mesh/Sprite/etc.)
     * @param {object} sprite sprite object that contains the text as texture (THREE.Sprite)
     * @param {string} letter new text to be displayed on the sprite
     * @param {string} color hex color of the text. e.g. (#76ba98)
     */
    updateLetterTextureOnSprite(sprite, letter, color)
    {
        letter = ""+letter
        sprite.material.map.dispose()
        sprite.material.map = this.createLetterTexture(letter, color, 80)
        sprite.material.size = sprite.material.map.image.width/5
        sprite.material.needsUpdate = true
    }



    /**
     * updates the axes with a new length and new numbers to display
     * @param {object} dimensions {xLen, yLen, zLen} 
     * @param {object} normalization {maxX1, maxX2, maxX3} 
     */
    updateAxesNumbers(dimensions, normalization)
    {
        // is there even all the information needed for normalization available?
        if(isNaN(normalization.maxX1 + normalization.maxX2 + normalization.maxX3))
            // undefined + 2 = NaN
            return

        if(this.axes == undefined)
            return console.warn("no axes are available. try", this.createAxes)

        /*this.disposeMesh(this.xNumber)
        this.disposeMesh(this.yNumber)
        this.disposeMesh(this.zNumber)*/

        let xLen = dimensions.xLen
        let yLen = dimensions.yLen
        let zLen = dimensions.zLen

        // decide about the visibility
        let showx1 = dimensions.xLen != 0 && dimensions.xRes != 0
        let showx2 = dimensions.yLen != 0 && dimensions.yRes != 0
        let showx3 = dimensions.zLen != 0 && dimensions.zRes != 0

        // text indication number ranges
        let xNumber
        let yNumber
        let zNumber
        if(normalization != undefined && normalization != {})
        {
            let offset2 = -0.075
            //round to significant number (toPrecision) and then remove the zeros at the end (parseFloat) if there are any
            let x1 = parseFloat(normalization.maxX1.toPrecision(3))
            let x2 = parseFloat(normalization.maxX2.toPrecision(3))
            let x3 = parseFloat(normalization.maxX3.toPrecision(3))

            if(showx1) // x
            {
                if(this.xNumber == undefined)
                {
                    xNumber = this.placeLetter(x1, this.axesColor, new THREE.Vector3(xLen, offset2, offset2))
                    this.axes.add(xNumber)
                    this.xNumber = xNumber
                }
                else
                {
                    this.updateLetterTextureOnSprite(this.xNumber, x1, this.axesColor)
                    this.xNumber.position.set(xLen, offset2, offset2)
                }
            }

            if(showx2) // y
            {
                let ypos = ((normalization.maxX2 - normalization.minX2) / normalization.x2frac) * yLen
                if(this.yNumber == undefined)
                {
                    yNumber = this.placeLetter(x2, this.axesColor, new THREE.Vector3(offset2, ypos, offset2))
                    this.axes.add(yNumber)
                    this.yNumber = yNumber
                }
                else
                {
                    this.updateLetterTextureOnSprite(this.yNumber, x2, this.axesColor)
                    this.yNumber.position.set(offset2, ypos, offset2)
                }
            }

            if(showx3) // z
            {
                if(this.zNumber == undefined)
                {
                    zNumber = this.placeLetter(x3, this.axesColor, new THREE.Vector3(offset2, offset2, zLen))
                    this.axes.add(zNumber)
                    this.zNumber = zNumber
                }
                else
                {
                    this.updateLetterTextureOnSprite(this.zNumber, x3, this.axesColor,0.05)
                    this.zNumber.position.set(offset2, offset2, zLen)
                }
            }
        }
    }



    /**
     * If axesare available, call createAxes to recreate them. If not, do nothing
     * @param {object} dimensions {xLen, yLen, zLen} 
     * @param {object} normalization {maxX1, maxX2, maxX3} 
     */
    updateAxesSize(dimensions, normalization)
    {
        if(this.axes != undefined)
            this.createAxes(this.axesColor,dimensions,normalization)
    }

    

    /**
     * creates the lines that point into the three x, y and z directions, adds the arrows at the tips, adds "x" "y" and "z" labels.
     * @private
     * @param {string} color     hex string of the axes color. default black #000000
     * @param {object} dimensions {xLen, yLen, zLen} 
     * @param {object} normalization {maxX1, maxX2, maxX3} 
     */
    createAxes(color="#000000", dimensions, normalization)
    {
        this.disposeMesh(this.axes)
        this.xNumber = undefined
        this.yNumber = undefined
        this.zNumber = undefined

        let xLen = dimensions.xLen
        let yLen = dimensions.yLen
        let zLen = dimensions.zLen

        let showx1 = dimensions.xLen != 0 && dimensions.xRes != 0
        let showx2 = dimensions.yLen != 0 && dimensions.yRes != 0
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



        this.axesColor = "#"+colorObject.getHexString() // to be able to easily redraw it later with the same color

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
          });
        let axesWire = new THREE.Mesh(axesWireGeom, axesWireMat)
        axesWire.name = "axesWire"
        axes.add(axesWire)


        // arrows that sit at the end of the lines
        let arrowMat = new THREE.MeshBasicMaterial({
            color: color
        });
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
            xLetter = this.placeLetter("x", this.axesColor, new THREE.Vector3(xLen*percentage+offset,0,0), 80, 0.05)
            axes.add(xLetter)
        }

        if(showx2) {
            let yLetter
            yLetter = this.placeLetter("y", this.axesColor, new THREE.Vector3(0, yLen*percentage+offset,0), 80, 0.05)
            axes.add(yLetter)
        }

        if(showx3) {
            let zLetter
            zLetter = this.placeLetter("z", this.axesColor, new THREE.Vector3(0,0, zLen*percentage+offset), 80, 0.05)
            axes.add(zLetter)
        }

        // updateAxesNumbers relies on this.axes, so make sure this is assigned before it
        this.axes = axes

        // normalization might be undefined when there is no plot yet to show
        if(normalization != undefined)
            this.updateAxesNumbers(dimensions,normalization)

        axes.name = "axesGroup"

        // add the axes group to the scene and store it locally in the object
        this.scene.add(axes)
    }
    
    
    
    /**
     * frees memory and removes the mesh (by making it available for the garbage collegtor)
     */
    disposeMesh(mesh)
    {   
        if(mesh != undefined)
        {
            if(mesh.geometry != undefined)
                mesh.geometry.dispose()

            //disppose material
            if(mesh.material != undefined)
            {
                if(mesh.material.length == undefined && mesh.material != undefined)
                    mesh.material.dispose()
                    
                if(!isNaN(mesh.material.length))
                {
                    //material is an array
                    for(let i = 0;i < mesh.material.length; i++)
                        mesh.material[i].dispose()
                }

                // for sprites material.map.dispose() seems to be important
            }

            if(mesh.texture != undefined)
                mesh.texture.dispose()

            // recursively clear the children
            for(let i = 0;i < mesh.children.length; i++)
                this.disposeMesh(mesh.children[i])
                
            if(mesh.parent != null)
                mesh.parent.remove(mesh)
                
            if(mesh != undefined)
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
        if(animationFunc == undefined)
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