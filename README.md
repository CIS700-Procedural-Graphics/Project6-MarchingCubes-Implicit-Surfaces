Grace Xu

Implemented: 
1) Animate meatballs - 5
2) Metaball function - 2
3) Sampling corners - 18
4) Polygonization (compute vertices and normals) - 50
5) Meshing - kind of
6) Materials and Post Processing - kind of

I ended up just using geom.computeFaceNormals() to get the resulting mesh instead of passing in my computed normals. 
I tried adding my iridescent shader from the previous hw and using a BufferGeometry to pass in my computed normals but for some reason it doesn't work quite right (you can toggle between the two shaders using the checkbox I added to the GUI). Would've come to office hours to try and figure it out because I feel like I'm really close...but alas, I'm in North Carolina. 