# Project 6: Implicit surfaces - Marching cubes

## View the Project

Note: unclick show grid and show spheres for faster loading time.</br>

# [Click Here](https://hanbollar.github.io/Project6-MarchingCubes-Implicit-Surfaces/)

## The Project

**Project Description:** Implemented an isosurface created from metaballs using the marching cubes algorithm. 

Metaballs are organic-looking n-dimensional objects. I implemented 3-dimensional metaballs. Using these we can make blooping shapes such as those in a lava-lamp. An isosurface is created whenever the metaball function crosses a certain threshold, called isolevel. The metaball function describes the total influences of each metaball to a given points. A metaball influence is a function between its radius and distance to the point:

`f(point) = (radius * radius) / (distance * distance)`

By summing up all these influences, you effectively describes all the points that are greater than the isolevel as inside, and less than the isolevel as outside (or vice versa). As an observation, the bigger the metaball's radius is, the bigger its influence is.

Marching cubes essentially voxelize the space, then generate triangles based on the density function distribution at the corners of each voxel. By increasing the voxelized grid's resolution, the surface eventually gets that blobby, organic look of the metaballs. Marching cubes can achieve a similar effect to ray marching for rendering implicit surfaces, but in addition to the rendered image, you also retain actual geometries. 

Marching cubes are commonly used in MRI scanning, where you can generate geometries for the scans. Marching cubes are also used to generate complex terrains with caves in games. The additional geometry information can handily support collision and other physical calculation for game engines. For example, their bounding boxes can then be computed to construct the acceleration data structure for collisions.

## Resources that I used for this assignment

- [Generating complex terrain](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch01.html) from [GPU Gems 3](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_pref01.html).
- [Polygonising a scalar field](http://paulbourke.net/geometry/polygonise/) by Paul Bourke.
- [Marching squares](http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/) by Jamie Wong.

## Sampling at corners
For my implementation of sampling at corners, I do generate new samples at each corner of the voxel to later polygonize the voxel, I just dont have their values show up on the screen. Their isovalues are still updated so the metaballs properly change.

- **TRI_TABLE**: This table acts as the triangle indices. Every 16 elements in the table represents a possible polygonizing configuration. Within each configuration, every three consecutive elements represents the indices of a triangle that should be created from the edges above. 
- **EDGE_TABLE**: This table returns a 12-bit number that represents the edges intersected by the isosurface. For each intersected edge, compute the linearly interpolated vertex position on the edge according to the isovalue at each end corner of the edge.

## Meshing
The mesh for the metaball's isosurface should be created once. At each frame, I used the list of **vertices** and **normals** polygonized from the voxels, update the mesh's geometry for the isosurface.

## Materials and post-processing
I implemented irradiance here.

## Visuals of the project

Image: 
![Image][img]
Low Resolution Visual: 
![Low Res Visual][lowResVis]
Low Res Debugging Visual [spheres and voxel cubes]: 
![Debugging Visuals][debugVis]
High Resolution Visual: 
![High Res Visual][highResVis]



[img]: https://github.com/hanbollar/Project6-MarchingCubes-Implicit-Surfaces/blob/master/forReadme/_img.png "Image"
[lowResVis]: https://github.com/hanbollar/Project6-MarchingCubes-Implicit-Surfaces/blob/master/forReadme/_trim1.gif "Low Res Visual"
[debugVis]: https://github.com/hanbollar/Project6-MarchingCubes-Implicit-Surfaces/blob/master/forReadme/_trim2.gif "Low Res Debugging Visual [spheres and voxel cubes]"
[highResVis]: https://github.com/hanbollar/Project6-MarchingCubes-Implicit-Surfaces/blob/master/forReadme/_increasedRes.gif "High Res Visual"