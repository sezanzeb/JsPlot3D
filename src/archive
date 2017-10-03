
    //modify the plane according to the data
    let positions = plot.getVerticesData(BABYLON.VertexBuffer.PositionKind)

    //http://www.html5gamedevs.com/topic/20050-update-vertices-of-a-box/
    // Build a map containing all vertices at the same position
    let numberOfPoints = positions.length / 3
    let map = []
    for (let i = 0; i < numberOfPoints; i++)
    {
        let p = new BABYLON.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);

        let found = false
        for (let index = 0; index < map.length && !found; index++)
        {
            let array = map[index]
            let p0 = array[0]
            if (p0.equals(p) || (p0.subtract(p)).lengthSquared() < 0.01)
            {
                array.push(i * 3)
                found = true
            }
        }
        if (!found)
        {
            let array = []
            array.push(p, i * 3)
            map.push(array)
        }
    }


    /**
     * For each vertex at a given position, move it according to the plot data
     * 
     * @param array     list of points that are at the same position of the unaltered mesh
     */
    map.forEach(function(array)
    {
        let index, min = -1, max = 1
        let ry = Math.random() * (max-min) - min
    
        for (index = 1; index < array.length; index ++)
        {
            let i = array[index]
            //positions[i] += rx
            positions[i+1] += ry
            //positions[i+2] += rz
        }
    })


    plot.setVerticesData(BABYLON.VertexBuffer.PositionKind,positions)






//not sure if i'm going to need the following
/**
 * creates the 3D-plot
 * http://www.html5gamedevs.com/topic/4530-create-a-mesh-from-a-list-of-vertices-and-faces/
 * 
 * @param data      array of [[x1,x2,x3],..] values
 */
function createPlotMesh2(data)
{
    BABYLON.Mesh.CreateBox = function (name, size, scene, updatable)
    {        
        let box = new BABYLON.Mesh(name, scene)
        let normalsSource = [            
            new BABYLON.Vector3(0, 0, 1),            
            new BABYLON.Vector3(0, 0, -1),            
            new BABYLON.Vector3(1, 0, 0),            
            new BABYLON.Vector3(-1, 0, 0),            
            new BABYLON.Vector3(0, 1, 0),            
            new BABYLON.Vector3(0, -1, 0)        
        ]
        let indices = []
        let positions = []
        let normals = []
        let uvs = []
        // Create each face in turn.        
        for (let index = 0; index < normalsSource.length; index++) 
        {            
            let normal = normalsSource[index]
            // Get two vectors perpendicular to the face normal and to each other.            
            let side1 = new BABYLON.Vector3(normal.y, normal.z, normal.x)
            let side2 = BABYLON.Vector3.Cross(normal, side1)
            // Six indices (two triangles) per face.            
            let verticesLength = positions.length / 3
            indices.push(verticesLength)
            indices.push(verticesLength + 1)
            indices.push(verticesLength + 2)
            indices.push(verticesLength)
            indices.push(verticesLength + 2)
            indices.push(verticesLength + 3)
            // Four vertices per face.            
            let vertex = normal.subtract(side1).subtract(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(1.0, 1.0)
            vertex = normal.subtract(side1).add(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(0.0, 1.0)
            vertex = normal.add(side1).add(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(0.0, 0.0)
            vertex = normal.add(side1).subtract(side2).scale(size / 2)
            positions.push(vertex.x, vertex.y, vertex.z)
            normals.push(normal.x, normal.y, normal.z)
            uvs.push(1.0, 0.0)
        }        
        box.setVerticesData(positions, BABYLON.VertexBuffer.PositionKind, updatable)
        box.setVerticesData(normals, BABYLON.VertexBuffer.NormalKind, updatable)
        box.setVerticesData(uvs, BABYLON.VertexBuffer.UVKind, updatable)
        box.setIndices(indices)
        return box
    }
}