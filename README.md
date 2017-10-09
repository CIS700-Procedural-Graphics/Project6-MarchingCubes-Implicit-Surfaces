# Metaballs and Marching cubes

### View the project [here](https://sknop8.github.io/Metaballs/)!

I implemented an isosurface created from metaballs using the marching cubes algorithm!!

![](https://github.com/sknop8/Project6-MarchingCubes-Implicit-Surfaces/blob/56b8d851539a0f394520f3b2d001a2f3826ead6e/mymetaballs.gif)

### About
**Metaballs** are organic-looking n-dimensional objects that are great for making bloppy shapes. An isosurface is created whenever the metaball function crosses a certain threshold, called isolevel.  
**Marching cubes** essentially voxelize the space, then generate triangles based on the density function distribution at the corners of each voxel. By increasing the voxelized grid's resolution, the surface eventually gets that blobby, organic look of the metaballs. Marching cubes can achieve a similar effect to ray marching for rendering implicit surfaces, but in addition to the rendered image, you also retain actual geometries.

### Resources I used
* http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
* http://paulbourke.net/geometry/polygonise/

