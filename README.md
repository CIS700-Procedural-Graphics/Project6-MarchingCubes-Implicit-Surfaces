# Project 6: Implicit surfaces - Marching cubes

## Project Description

Created 3-dimensional metaballs using the marching cubes mesh creation technique.

## Technical details for metaballs

Metaballs are organic-looking n-dimensional objects. They are great to make bloppy shapes. An isosurface is created whenever the metaball function crosses a certain threshold, called isolevel. The metaball function describes the total influences of each metaball to a given points. A metaball influence is a function between its radius and distance to the point:

`f(point) = (radius * radius) / (distance * distance)`

By summing up all these influences, you effectively describes all the points that are greater than the isolevel as inside, and less than the isolevel as outside (or vice versa). As an observation, the bigger the metaball's radius is, the bigger its influence is.

Marching cubes essentially voxelize the space, then generate triangles based on the density function distribution at the corners of each voxel. By increasing the voxelized grid's resolution, the surface eventually gets that blobby, organic look of the metaballs. Marching cubes can achieve a similar effect to ray marching for rendering implicit surfaces, but in addition to the rendered image, you also retain actual geometries.

Marching cubes are commonly used in MRI scanning, where you can generate geometries for the scans. Marching cubes are also used to generate complex terrains with caves in games. The additional geometry information can handily support collision and other physical calculation for game engines. For example, their bounding boxes can then be computed to construct the acceleration data structure for collisions.

## Resources
We suggest reading the following resources before starting your assignment:

- [Generating complex terrain](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch01.html) from [GPU Gems 3](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_pref01.html).
- [Polygonising a scalar field](http://paulbourke.net/geometry/polygonise/) by Paul Bourke.
- [Marching squares](http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/) by Jamie Wong.

### Iridescence Shader:

color is view point dependent shader;
