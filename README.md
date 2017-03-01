# Project 6: Implicit surfaces - Marching cubes
__Name: Rudraksha Shah__

__Penn ID: rdimple__

##Documentation

Implemented Marching Cubes and shaded the surface with iridescent shading.

BUG: Have one issue regarding the disappearence of certain triangles on the metaballs mesh where the triangles don't appear at certain places in the mesh. Working on fixing this issue.

---------------------------------------------------------------

**Goal:** Implement an isosurface created from metaballs using the marching cubes algorithm. 

Metaballs are organic-looking n-dimensional objects. We will be implementing a 3-dimensional metaballs. They are great to make bloppy shapes. An isosurface is created whenever the metaball function crosses a certain threshold, called isolevel. The metaball function describes the total influences of each metaball to a given points. A metaball influence is a function between its radius and distance to the point:

`f(point) = (radius * radius) / (distance * distance)`

By summing up all these influences, you effectively describes all the points that are greater than the isolevel as inside, and less than the isolevel as outside (or vice versa). As an observation, the bigger the metaball's radius is, the bigger its influence is.

Marching cubes essentially voxelize the space, then generate triangles based on the density function distribution at the corners of each voxel. By increasing the voxelized grid's resolution, the surface eventually gets that blobby, organic look of the metaballs. Marching cubes can achieve a similar effect to ray marching for rendering implicit surfaces, but in addition to the rendered image, you also retain actual geometries. 

Marching cubes are commonly used in MRI scanning, where you can generate geometries for the scans. Marching cubes are also used to generate complex terrains with caves in games. The additional geometry information can handily support collision and other physical calculation for game engines. For example, their bounding boxes can then be computed to construct the acceleration data structure for collisions.

**Warning**: this assignment option requires more effort than the ray marching option. The two base codes diverge significantly, so switching options midway can be costly for  your time and effort.

## Resources
We suggest reading the following resources before starting your assignment:

- [Generating complex terrain](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch01.html) from [GPU Gems 3](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_pref01.html).
- [Polygonising a scalar field](http://paulbourke.net/geometry/polygonise/) by Paul Bourke.
- [Marching squares](http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/) by Jamie Wong.

## Base code framework

We have provided a basecode as a reference. You are welcome to modify the framework for your project. The basecode implements metaballs on the CPU.

_main.js_:

  - `App`:

This is a global configuration object. All information for the marching cubes are stored here. 

**Note**: `App.visualDebug` is a global control of all the visual debugging components. Even though it is helpful for development, it could be memory intensive. Toggle this flag off for better perforamance at high resolution.

_marching_cubes.js_:

  - `class MarchingCubes`:
    This class encapsulates everything about the metaballs, grid, voxels, and sampling information.

  - `class Voxel`:
    This class contains information about a single voxel, and its sample points. Polygonization happens here.

_inspect_point.js_:

  - `class InspectPoint`:
    This class simply contains a single sample point that can output its value on the screen at its pixel location.

_metaball.js_:

  - `class Metaball`:
    This class represents a single metaball.

_marching_cube_LUT.js_:

This file contains the edge table and the triangle table for the marching cubes.

## Animate metaballs (5 points)
Implement the `update` for metaballs to move its position based velocity. Reverse the velocity whenever the metaball goes out of bounds. Since the metaball function is not well defined at the boundaries, maintain an additional small margin so that the metaball can reverse its moving direction before reaching the bounds.

## Metaball function (2 points)
Implement the metaball function inside `sample` of `MarchingCubes`. This function should return the total influences of all moving metaballs with respect to a given point.

## Sampling at corners (15 points)
In order to polygonize a voxel, generate new samples at each corner of the voxel. Their isovalues must be updated as the metaball function changes due of metaballs moving.

## Polygonization (50 points)
Implement `polygonize` inside `Cell` class. This function should return the list of **vertices** and **normals** of the triangles polygonized in the voxel. 

### Vertices (30 points out of 50)
To compute the vertices, we have provided the look-up tables from Paul Bourke's. The table assumes the following indexing scheme:
![](./ref_voxel_indexing.png)

- _The eight corners can be represented as an 8-bit number, where 1 means the isovalue is above or below the isolevel based on your implementation._
- _The twelve edges can be represented as a 12-bit number, where 1 means that the isosurface intersects with this edge._

- **EDGE_TABLE**: This table returns a 12-bit number that represents the edges intersected by the isosurface. For each intersected edge, compute the linearly interpolated vertex position on the edge according to the isovalue at each end corner of the edge.

- **TRI_TABLE**: This table acts as the triangle indices. Every 16 elements in the table represents a possible polygonizing configuration. Within each configuration, every three consecutive elements represents the indices of a triangle that should be created from the edges above. 

### Normals (20 points out of 50)
Compute the normals using the gradient of the vertex with respect to the x, y, and z. The normals are then used for shading different materials.

## Meshing (18 points)
The mesh for the metaball's isosurface should be created once. At each frame, using the list of **vertices** and **normals** polygonized from the voxels, update the mesh's geometry for the isosurface. Notice that the total volume of the mesh does change.

## Materials and post-processing (10 points)
Interesting shader materials beyond just the provided threejs materials. We encourage using your previous shaders assignment for this part.

## Extra credits (Up to 30 points)
- Metaball can be positive or negative. A negative metaball will substract from the surface, which pushed the surface inward. **Implement a scene with both positive and negative metaballs. (10 points)**
- **More implicit surfaces!** For example: planes, mesh, etc.). Some very interesting ideas are to blend your metaballs into those surfaces. **(5 points for each)**

## Submission

- Update `README.md` to contain a solid description of your project
- Publish your project to gh-pages. `npm run deploy`. It should now be visible at http://username.github.io/repo-name
- Create a [pull request](https://help.github.com/articles/creating-a-pull-request/) to this repository, and in the comment, include a link to your published project.
- Submit the link to your pull request on Canvas.

## Deploy
- `npm run build`
- Add and commit all changes
- `npm run deploy`
- If you're having problems with assets not linking correctly, make sure you wrap you're filepaths in `require()`. This will make the bundler package and your static assets as well. So, instead of `loadTexture('./images/thing.bmp')`, do `loadTexture(require('./images/thing.bmp'))`.