Lava Lamp: FlowOn

Marching Cubes:
Created a lava lamp with implicit surfaces. The "lava" is created by a collection of spheres. The isosurface is defined by the summation of the sphere influences. Sphere influence is 1 at the sphere boundary and decreases farther away from the sphere. The Isosurface region is all points where the total sphere influence is greater than a set isolevel value. These calculations are done on each vertex of a voxel grid. Once each vertex has a isovalue, the triangle mesh is defined according to the values at each of the 8 voxel corners. This configuation is stored in a 8 bit value, where each bit represents a vertex and whether it is "in" or "out" of the surface. The 8 bit values goes into a look up table that returns a 12 bit value containing the edges that are intersected by the mesh. The points that define the mesh are determined by interpolating between the isovalues on the corners. Finally, the faces are defined by a second table. This algorithm is called the marching cubes algorithm 

The metaball's position and velocity is update at every time step. The position is maintained within the boundary by calculating the distance to the boundaries and updating the velocity according to this value. 

Shaders:
The lava is shaded with GLSL matcap shader, using a lit sphere texture. The idea behind this shader uses environment mapping. The lava lamp has a emissive lambert shader (THREE.js). The color is smoothed with a procedural cosine color mapping. I modeled the lamp in Autodesk Maya. 

Since watching the lava lamp and metaballs move is so soothing, I decided to create a website with inspiration quotes (A new one each time the web page loads). 