const THREE = require("three")
const OrbitControls = require('three-orbit-controls')(THREE)
const COLORLIB = require("./JsP3D_ColorLib.js")

export default class JsP3D_SceneHelper
{

    /**
     * 
     */
    constructor()
    {
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
    }



    /**
     * scene setup. Szene, Camera, Lighting, Axes
     * @param {*} dimensions 
     * @param {*} sceneOptions 
     * @param {*} cameraOptions 
     */
    createScene(dimensions,sceneOptions,cameraOptions)
    {
        if(this.renderer == undefined)
            return console.error("createScene has to be called after setupRendering. this.renderer is undefined")

        let backgroundColor = 0xffffff
        let axesColor = 0x000000

        if(sceneOptions.backgroundColor != undefined)
            backgroundColor = sceneOptions.backgroundColor
        if(sceneOptions.axesColor != undefined)
            axesColor = sceneOptions.axesColor

        this.scene = new THREE.Scene()
        this.createLight()
        this.createAxes(axesColor, dimensions)
        this.createArcCamera(cameraOptions.width,cameraOptions.height)

        this.renderer.setClearColor(COLORLIB.getColorObjectFromAnyString(backgroundColor))
    }



    /**
     * 
     * @param {number[]} pos THREE.Vector3 camera position {x,y,z}
     * @param {number[]} target THREE.Vector3 camera target. The center of what can be seen on the screen {x,y,z}
     */
    moveCamera(pos,target)
    {
        this.camera.position.set(pos.x,pos.y,pos.z)
        this.cameraControls.target.set(target.x,target.y,target.z)
        this.camera.lookAt(this.cameraControls.target)
    }



    /**
     * moves the camera to a good position to watch over the whole plot
     * @param {object} dimensions {xLen,yLen,zLen} 
     */
    centerCamera(dimensions)
    {
        //camera already created? It might be called by setDimensions in the constructor before the camera creation
        if(this.camera == undefined)
            return

        let xLen = dimensions.xLen
        let yLen = dimensions.yLen
        let zLen = dimensions.zLen

        this.camera.position.set(xLen/2,Math.max(zLen,yLen),zLen+xLen)
        this.cameraControls.target.set(xLen/2,yLen/2,zLen/2)
        this.camera.lookAt(this.cameraControls.target)
    }


    /** Creates the camera
     * @private
     */
    createArcCamera(width,height)
    {

        let viewAngle = 80
        let aspect = width / height
        let near = 0.05 // when objects start to disappear at zoom-in
        let far = 20 // when objects start to disappear at zoom-out
        let camera = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)

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
        controls.maxDistance = 5
        controls.minDistance = 0.3

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

        let directionalLight1 = new THREE.DirectionalLight(color1, 0.3)
        directionalLight1.position.y = 1;
        directionalLight1.name = "lightFromTop"
        this.scene.add(directionalLight1)

        let directionalLight2 = new THREE.DirectionalLight(color2, 0.3)
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
     * creates the axes that point into the three x, y and z directions as wireframes
     * @private
     * @param {string} color     hex string of the axes color. default black #000000
     */
    createAxes(color="#000000",dimensions)
    {
        this.axesColor = color // to be able to easily redraw it later with the same color
        this.disposeMesh(this.axes)

        let xLen = dimensions.xLen
        let yLen = dimensions.yLen
        let zLen = dimensions.zLen

        let axes = new THREE.Group()
        let percentage = 1.1 // how long the axes are to xLen, yLen and zLen

        let colorObject = COLORLIB.getColorObjectFromAnyString(color)
        if(colorObject != undefined)
            color = colorObject

        // lines that point into the dimensions
        let axesWireGeom = new THREE.Geometry()
        let cent = new THREE.Vector3(0,0,0)
        let xend = new THREE.Vector3(xLen*percentage,0,0)
        let yend = new THREE.Vector3(0,yLen*percentage,0)
        let zend = new THREE.Vector3(0,0,zLen*percentage)
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
        axes.add(axesWire)


        // arrows that sit at the end of the lines
        let arrowMat = new THREE.MeshBasicMaterial({
            color: color
        });
        let arrowGeom = new THREE.ConeGeometry(0.02,0.066,12)
        let arrowMesh1 = new THREE.Mesh(arrowGeom, arrowMat)
        let arrowMesh2 = new THREE.Mesh(arrowGeom, arrowMat)
        let arrowMesh3 = new THREE.Mesh(arrowGeom, arrowMat)
        arrowMesh1.rotateZ(-Math.PI/2)
        arrowMesh3.rotateX(Math.PI/2)
        arrowMesh1.position.set(xLen*percentage,0,0)
        arrowMesh2.position.set(0,yLen*percentage,0)
        arrowMesh3.position.set(0,0,zLen*percentage)
        axes.add(arrowMesh1)
        axes.add(arrowMesh2)
        axes.add(arrowMesh3)

        let placeLetter = function(letter, textColor, position)
        {
            // write text to a canvas
            let textCanvas = document.createElement('canvas')
            textCanvas.height = 128
            textCanvas.width = 64
            let context2d = textCanvas.getContext('2d')
            context2d.font = "Bold 80px sans-serif"
            context2d.fillStyle = textColor // textclr
            context2d.fillText(letter,0,80) // write
    
            // create a texture from the canvas
            let canvasToTexture = new THREE.Texture(textCanvas)
            let textureToSprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: canvasToTexture,
                alphaTest: 0.6
            }))
    
            // transform
            let size = 0.05
            textureToSprite.scale.set(size,2*size)
            textureToSprite.position.set(position.x,position.y,position.z)
    
            // finish
            canvasToTexture.needsUpdate = true
            return textureToSprite
        }

        // text indicating the dimension name
        let offset = 0.1
        let xLetter = placeLetter("x","#"+colorObject.getHexString(), new THREE.Vector3(xLen*percentage+offset,0,0))
        let yLetter = placeLetter("y","#"+colorObject.getHexString(), new THREE.Vector3(0,yLen*percentage+offset,0))
        let zLetter = placeLetter("z","#"+colorObject.getHexString(), new THREE.Vector3(0,0,zLen*percentage+offset))
        axes.add(xLetter)
        axes.add(yLetter)
        axes.add(zLetter)

        axes.name = "axesGroup"

        // add the axes group to the scene and store it locally in the object
        this.scene.add(axes)
        this.axes = axes
    }
    
    
    
    /**
     * frees memory and removes the plotmesh (by making it available for the garbage collegtor)
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
     * changes the background color and triggers a rerender
     * @param {string} color
     */
    setBackgroundColor(color)
    {
        let colorObject = COLORLIB.getColorObjectFromAnyString(color)
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