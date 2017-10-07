//very close to working, but I'm going to use built in functions

if(!scatterplot)
{
    if(this.plotmesh != undefined)
        this.scene.remove(this.plotmesh)

    let y = 0
    let x = 0
    let z = 0

    let geom = new THREE.Geometry()
    let vIndex = 0
    let j = 0

    //memorizes the indices that have been in the previous line
    let indicesMemory = new Array(this.zLen*this.zRes)
    let indicesMemoryNew = new Array(this.zLen*this.zRes)

    //add vertices
    let buildPlot = function(i, j, vIndex, indicesMemory, dir)
    {
        x = i/this.xRes
        z = j/this.zRes
        y = this.f(x,z)
        
        //push a new vertex
        geom.vertices.push(new THREE.Vector3(x,y,z))

        //afterwards build a face using that vertex
        //
        //     0 +----+----+----+----+ 4
        //                 b    a    |
        //     9 +----+----+----+----+ 5
        //       |
        //    10 +----+----+----+->  + 14
        //                 e    d
        //
        // line nr (x). is i, col nr (z). is j
        //
        // e is the current vertex.
        // take the vertex that is on the other side, that means b
        // take the previous vertex, which is d
        // finished, three vertex make one face
        //
        // do this once it's one vertex away from the side, which means:
        // j < zLen*zRes && j >= 0
        //
        // all i have to get now is the index of b, d and e
        //
        // and then do another face with b a and d

        let v = vIndex
        if(i > 0 && j >= 0)
        {
            //read from indicesMemory, which is supposed to be b
            let e = v
            let d = v+dir
            let b = indicesMemory[j]
            let face = new THREE.Face3(e,d,b) //I need this object to color the vertex afterwards
            geom.faces.push(face)
            
            //now face the triangle that is missing
            let a = indicesMemory[j+1]
            let face2 = new THREE.Face3(b,a,d)
            geom.faces.push(face2)

            //console.log("hsl("+Math.abs(Math.min(1,Math.max(y,0)))+",100%,100%)")
        }
        //write to indicesMemoryNew
        indicesMemoryNew[j] = vIndex

    }.bind(this)

    
    //go over the x-z plane like a snake
    //     +----+----+----+----+
    //                         |
    //     +----+----+----+----+
    //     |
    //     +----+----+----+----+
    for(let i = 0; i < this.xVerticesCount; i++)
    {
        //from 0 to max
        for(; j < this.zVerticesCount; j++)
        {
            buildPlot(i, j, vIndex, indicesMemory, 1)
            vIndex ++
        }
        j -- //j is 1 too large now

        //check if end reached
        i ++ //nextline
        if(!(i < this.xVerticesCount))
            break

        //swap the indicesMemory
        indicesMemory = indicesMemoryNew.slice()

        //from max to 0
        for(; j >= 0; j--)
        {
            buildPlot(i, j, vIndex, indicesMemory, -1)
            vIndex ++
        }
        j ++ //j is -1 now.
        
        //swap the indicesMemory
        indicesMemory = indicesMemoryNew.slice()

        //it goes around like a snake, which means
        //that i can connect the most recent 3 vertices to a face
    }

    //color the plot
    let plotmat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        wireframe: true,
        side: THREE.DoubleSide
        })

    this.plotmesh = new THREE.Mesh(geom, plotmat)
    this.scene.add(this.plotmesh);
}