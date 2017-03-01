const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );


export default class MarchingCubes {

  constructor(App) {
    this.init(App);
  }

  init(App) {
    this.isPaused = false;
    VISUAL_DEBUG = App.config.visualDebug;

    // Initializing member variables.
    // Additional variables are used for fast computation.
    this.origin = new THREE.Vector3(0);

    this.isolevel = App.config.isolevel;
    this.minRadius = App.config.minRadius;
    this.maxRadius = App.config.maxRadius;

    this.gridCellWidth = App.config.gridCellWidth;
    this.halfCellWidth = App.config.gridCellWidth / 2.0;
    this.gridWidth = App.config.gridWidth;

    this.res = App.config.gridRes;
    this.res2 = App.config.gridRes * App.config.gridRes;
    this.res3 = App.config.gridRes * App.config.gridRes * App.config.gridRes;

    this.maxSpeed = App.config.maxSpeed;
    this.numMetaballs = App.config.numMetaballs;

    this.camera = App.camera;
    this.scene = App.scene;

    this.voxels = [];
    this.labels = [];
    this.balls = [];


    //CREATING MESH OBJECT
    var geom = new THREE.Geometry();
    var object = new THREE.Mesh( geom, new THREE.MeshNormalMaterial() );
    this.meshGeom = object;



    this.showSpheres = true;
    this.showGrid = true;

    if (App.config.material) {
      this.material = new THREE.MeshPhongMaterial({ color: 0xff6a1d});
    } else {
      this.material = App.config.material;
    }

    this.setupCells();
    this.setupMetaballs();
    this.makeMesh();
  };

  // Convert from 1D index to 3D indices
  i1toi3(i1) {

    // [i % w, i % (h * w)) / w, i / (h * w)]

    // @note: ~~ is a fast substitute for Math.floor()
    return [
      i1 % this.res,
      ~~ ((i1 % this.res2) / this.res),
      ~~ (i1 / this.res2)
      ];
  };

  // Convert from 3D indices to 1 1D
  i3toi1(i3x, i3y, i3z) {

    // [x + y * w + z * w * h]

    return i3x + i3y * this.res + i3z * this.res2;
  };

  // Convert from 3D indices to 3D positions
  i3toPos(i3) {

    return new THREE.Vector3(
      i3[0] * this.gridCellWidth + this.origin.x + this.halfCellWidth,
      i3[1] * this.gridCellWidth + this.origin.y + this.halfCellWidth,
      i3[2] * this.gridCellWidth + this.origin.z + this.halfCellWidth
      );
  };

  setupCells() {

    // Allocate voxels based on our grid resolution
    this.voxels = [];
    for (var i = 0; i < this.res3; i++) {
      var i3 = this.i1toi3(i);
      var {x, y, z} = this.i3toPos(i3);
      var voxel = new Voxel(new THREE.Vector3(x, y, z), this.gridCellWidth);
      this.voxels.push(voxel);

      if (VISUAL_DEBUG) {
        this.scene.add(voxel.wireframe);
        this.scene.add(voxel.mesh);
      }
    }
  }

  setupMetaballs() {

    this.balls = [];

    var x, y, z, vx, vy, vz, radius, pos, vel;
    var matLambertWhite = LAMBERT_WHITE;
    var maxRadiusTRippled = this.maxRadius * 3;
    var maxRadiusDoubled = this.maxRadius * 2;

    // Randomly generate metaballs with different sizes and velocities
    for (var i = 0; i < this.numMetaballs; i++) {
      x = this.gridWidth / 2;
      y = this.gridWidth / 2;
      z = this.gridWidth / 2;
      pos = new THREE.Vector3(x, y, z);

      vx = (Math.random() * 2 - 1) * this.maxSpeed;
      vy = (Math.random() * 2 - 1) * this.maxSpeed;
      vz = (Math.random() * 2 - 1) * this.maxSpeed;
      vel = new THREE.Vector3(vx, vy, vz);

      radius = Math.random() * (this.maxRadius - this.minRadius) + this.minRadius;

      var ball = new Metaball(pos, radius, vel, this.gridWidth, VISUAL_DEBUG);
      this.balls.push(ball);

      if (VISUAL_DEBUG) {
        this.scene.add(ball.mesh);
      }
    }
  }

  // This function samples a point from the metaball's density function
  // Implement a function that returns the value of the all metaballs influence to a given point.
  // Please follow the resources given in the write-up for details.
  sample(point) {
    // @TODO
    /*  METABALL FUNCTION (2 POINTS)
    Metaballs are organic-looking n-dimensional objects. We will be implementing a 3-dimensional metaballs.
    They are great to make bloppy shapes. An isosurface is created whenever the metaball function
    crosses a certain threshold, called isolevel. The metaball function describes the total influences
    of each metaball to a given points. A metaball influence is a function between its radius and distance to the point:

      f(point) = (radius * radius) / (distance * distance)

    By summing up all these influences, you effectively describes all the points that are greater than
    the isolevel as inside, and less than the isolevel as outside (or vice versa).
    As an observation, the bigger the metaball's radius is, the bigger its influence is.
    --------------------------------------------------------------------------------------------------
    */

    var isovalue = 0.0;//1.1; //BRINGING IT TO 0 WILL ONLY SHOW THE GRID CELL CUBES WHERE THE ISOVALUE IS >= 1 (but this doesn't always work?)

    for(var i = 0; i < this.numMetaballs; i++)
    {
      var currBall = this.balls[i];
      var dist = Math.sqrt(Math.pow(currBall.pos.x - point.x, 2) + Math.pow(currBall.pos.y - point.y, 2) + Math.pow(currBall.pos.z - point.z, 2));

      isovalue += ((currBall.radius * currBall.radius) / (dist * dist));
    }
    return isovalue;
  }//end sample function

  update() {

    if (this.isPaused) {
      return;
    }

    // This should move the metaballs
    this.balls.forEach(function(ball) {
      ball.update();
    });


    /*  SAMPLING AT CORNERS (15 POINTS)
    In order to polygonize a voxel, generate new samples at each corner of the voxel.
    Their isovalues must be updated as the metaball function changes due of metaballs moving.
    */
    for (var c = 0; c < this.res3; c++) {

      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);

      this.voxels[c].FUpperLeft.isovalue = this.sample(this.voxels[c].FUpperLeft.pos);
      this.voxels[c].FUpperRight.isovalue = this.sample(this.voxels[c].FUpperRight.pos);
      this.voxels[c].FLowerLeft.isovalue = this.sample(this.voxels[c].FLowerLeft.pos);
      this.voxels[c].FLowerRight.isovalue = this.sample(this.voxels[c].FLowerRight.pos);
      //back face verts
      this.voxels[c].BUpperLeft.isovalue = this.sample(this.voxels[c].BUpperLeft.pos);
      this.voxels[c].BUpperRight.isovalue = this.sample(this.voxels[c].BUpperRight.pos);
      this.voxels[c].BLowerLeft.isovalue = this.sample(this.voxels[c].BLowerLeft.pos);
      this.voxels[c].BLowerRight.isovalue = this.sample(this.voxels[c].BLowerRight.pos);

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {

        // Toggle voxels on or off
        if (this.voxels[c].center.isovalue > this.isolevel) {
          this.voxels[c].show();
        }
        else {
          this.voxels[c].hide();
        }

        this.voxels[c].center.updateLabel(this.camera);

        this.voxels[c].FUpperLeft.updateLabel(this.camera);
        this.voxels[c].FUpperRight.updateLabel(this.camera);
        this.voxels[c].FLowerLeft.updateLabel(this.camera);
        this.voxels[c].FLowerRight.updateLabel(this.camera);
        this.voxels[c].BUpperLeft.updateLabel(this.camera);
        this.voxels[c].BUpperRight.updateLabel(this.camera);
        this.voxels[c].BLowerLeft.updateLabel(this.camera);
        this.voxels[c].BLowerRight.updateLabel(this.camera);

      }

      else {
        this.voxels[c].center.clearLabel();

        this.voxels[c].FUpperLeft.clearLabel();
        this.voxels[c].FUpperRight.clearLabel();
        this.voxels[c].FLowerLeft.clearLabel();
        this.voxels[c].FLowerRight.clearLabel();
        this.voxels[c].BUpperLeft.clearLabel();
        this.voxels[c].BUpperRight.clearLabel();
        this.voxels[c].BLowerLeft.clearLabel();
        this.voxels[c].BLowerRight.clearLabel();
      }
    }

    this.updateMesh();
  }

  pause() {
    this.isPaused = true;
  }

  play() {
    this.isPaused = false;
  }

  show() {
    for (var i = 0; i < this.res3; i++) {
      this.voxels[i].show();
    }
    this.showGrid = true;
  };

  hide() {
    for (var i = 0; i < this.res3; i++) {
      this.voxels[i].hide();
    }
    this.showGrid = false;
  };

  /*  MESHING (18 POINTS)
  The mesh for the metaball's isosurface should be created once.
  At each frame, using the list of vertices and normals polygonized from the voxels, update the mesh's geometry for the isosurface.
  Notice that the total volume of the mesh does change.
  */

  makeMesh() {
    // @TODO
    // var geom = new THREE.Geometry();
    // var object = new THREE.Mesh( geom, new THREE.MeshNormalMaterial() );
    // this.meshGeom = geom;

    this.meshGeom.dynamic = true;
    this.scene.add(this.meshGeom);
  }//end makeMesh

  updateMesh() {
    // @TODO

    //set the geometry to these new lists
    var newVerticesList = new Array();//[];
    var newFacesList = new Array();//[];

    //iterate through the vertices list
    for (var c = 0; c < this.voxels.length; c++) {
      var polygonizeResult = this.voxels[c].polygonize(this.isolevel, this.balls);
      var vertList = polygonizeResult.vertPositions;
      var normList = polygonizeResult.vertNormals;
      // console.log("PRINTING NORM LIST: ")
      // console.log(normList);
      // console.log(vertList);

      //sanity check to make sure vertList is correct
      if(vertList.length % 3 !== 0)
      {
        console.log("THE VERT LIST IS NOT DIVISIBLE BY THREE");
      }

      if(vertList.length != 0)
      {
        var _len = newVerticesList.length;
        for(var j = 0; j < vertList.length; j += 3)
        {
          //var newVert = new THREE.Vector3(vertList[i].x, vertList[i].y, vertList[i].z);
          var v1 = vertList[j];
          var v2 = vertList[j + 1];
          var v3 = vertList[j + 2];
          newVerticesList.push(v1);
          newVerticesList.push(v2);
          newVerticesList.push(v3);

          var newFace = new THREE.Face3(_len + j, _len + j + 1, _len + j + 2);

          newFace.vertexNormals[0] = normList[j];
          newFace.vertexNormals[1] = normList[j + 1];
          newFace.vertexNormals[2] = normList[j + 2];

          newFacesList.push(newFace);
        }//end for every vert
      }//end if vertlist
    }//end for every voxel loop

    if(this.meshGeom)
    {
      this.scene.remove(this.meshGeom);
    }

    var geom = new THREE.Geometry();
    geom.vertices = newVerticesList;
    geom.faces = newFacesList;
    var object = new THREE.Mesh( geom, new THREE.MeshNormalMaterial() );
    this.meshGeom = object;

    this.meshGeom.dynamic = true;
    this.meshGeom.elementsNeedUpdate = true;
    this.meshGeom.verticesNeedUpdate = true;
    this.scene.add(this.meshGeom);


    //WHY IS THIS NOT WORKING?!?!?!
    // this.meshGeom.dynamic = true;
    // this.meshGeom.geometry.vertices = newVerticesList;
    // this.meshGeom.geometry.faces = newFacesList;
    // // //this.meshGeom.computeFaceNormals();
    // this.meshGeom.elementsNeedUpdate = true;
    // this.meshGeom.verticesNeedUpdate = true;


  }//end updateMesh

};//end MarchingCube class

// ------------------------------------------- //

class Voxel {

  constructor(position, gridCellWidth) {
    this.init(position, gridCellWidth);
  }

  init(position, gridCellWidth) {
    this.pos = position;
    this.gridCellWidth = gridCellWidth;

    if (VISUAL_DEBUG) {
      this.makeMesh();
    }

    this.makeInspectPoints();
  }

  makeMesh() {
    var halfGridCellWidth = this.gridCellWidth / 2.0;

    var positions = new Float32Array([
      // Front face
       halfGridCellWidth, halfGridCellWidth,  halfGridCellWidth,
       halfGridCellWidth, -halfGridCellWidth, halfGridCellWidth,
      -halfGridCellWidth, -halfGridCellWidth, halfGridCellWidth,
      -halfGridCellWidth, halfGridCellWidth,  halfGridCellWidth,

      // Back face
      -halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth,
      -halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth,
    ]);

    var indices = new Uint16Array([
      0, 1, 2, 3,
      4, 5, 6, 7,
      0, 7, 7, 4,
      4, 3, 3, 0,
      1, 6, 6, 5,
      5, 2, 2, 1
    ]);

    // Buffer geometry
    var geo = new THREE.BufferGeometry();
    geo.setIndex( new THREE.BufferAttribute( indices, 1 ) );
    geo.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

    // Wireframe line segments
    this.wireframe = new THREE.LineSegments( geo, WIREFRAME_MAT );
    this.wireframe.position.set(this.pos.x, this.pos.y, this.pos.z);

    // Green cube
    geo = new THREE.BoxBufferGeometry(this.gridCellWidth, this.gridCellWidth, this.gridCellWidth);
    this.mesh = new THREE.Mesh( geo, LAMBERT_GREEN );
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }

  makeInspectPoints() {
    var halfGridCellWidth = this.gridCellWidth / 2.0;
    var x = this.pos.x;
    var y = this.pos.y;
    var z = this.pos.z;
    var red = 0xff0000;

    // Center dot
    this.center = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);

    //8 corners
    //front face verts
    var frontupperleft = new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth);
    var frontupperright = new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth);
    var frontlowerleft = new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth);
    var frontlowerright = new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth);
    this.FUpperLeft = new InspectPoint(frontupperleft, 0, VISUAL_DEBUG);
    this.FUpperRight = new InspectPoint(frontupperright, 0, VISUAL_DEBUG);
    this.FLowerLeft = new InspectPoint(frontlowerleft, 0, VISUAL_DEBUG);
    this.FLowerRight = new InspectPoint(frontlowerright, 0, VISUAL_DEBUG);

    //back face verts
    var backupperleft = new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth);
    var backupperright = new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth);
    var backlowerleft = new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth);
    var backlowerright = new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth);
    this.BUpperLeft = new InspectPoint(backupperleft, 0, VISUAL_DEBUG);
    this.BUpperRight = new InspectPoint(backupperright, 0, VISUAL_DEBUG);
    this.BLowerLeft = new InspectPoint(backlowerleft, 0, VISUAL_DEBUG);
    this.BLowerRight = new InspectPoint(backlowerright, 0, VISUAL_DEBUG);

  }

  show() {
    if (this.mesh) {
      this.mesh.visible = true;
    }
    if (this.wireframe) {
      this.wireframe.visible = true;
    }
  }

  hide() {
    if (this.mesh) {
      this.mesh.visible = false;
    }

    if (this.wireframe) {
      this.wireframe.visible = false;
    }

    if (this.center) {
      this.center.clearLabel();
    }
  }

  /*  VERTICES

  To compute the vertices, we have provided the look-up tables from Paul Bourke's. The table assumes the following indexing scheme:

  The eight corners can be represented as an 8-bit number, where 1 means the isovalue is above or below the isolevel based on your implementation.
  The twelve edges can be represented as a 12-bit number, where 1 means that the isosurface intersects with this edge.

  EDGE_TABLE : This table returns a 12-bit number that represents the edges intersected by the isosurface.
               For each intersected edge, compute the linearly interpolated vertex position on the edge
               according to the isovalue at each end corner of the edge.

  TRI_TABLE : This table acts as the triangle indices. Every 16 elements in the table represents
              a possible polygonizing configuration. Within each configuration, every three consecutive
              elements represents the indices of a triangle that should be created from the edges above.


  NORMALS
      * Compute the normals using the gradient of the vertex with respect to the x, y, and z.
      * The normals are then used for shading different materials.
  */

  vertexInterpolation(isolevel, posA, posB) {

    // @TODO

    var lerpPos = new THREE.Vector3(0.0, 0.0, 0.0);

    // console.log("PRINTING THE 2 POS: ");
    // console.log(posA);
    // console.log(posB);

    var posAiso = posA.isovalue;
    var posBiso = posB.isovalue;
    var posApos = posA.pos;
    var posBpos = posB.pos;

    // console.log("posAISO: " + posAiso);
    // console.log("posBISO: " + posBiso);

    var mu = 0.0;
    //var p = THREE.Vector3(0.0);

    if(Math.abs(isolevel - posAiso) < 0.00001) {return posApos;}
    if(Math.abs(isolevel - posBiso) < 0.00001) {return posBpos;}
    if(Math.abs(posAiso - posBiso) < 0.00001) {return posApos;}

    mu = (isolevel - posAiso) / (posBiso - posAiso);
    // console.log("MU:" + mu);

    lerpPos.x = posApos.x + mu * (posBpos.x - posApos.x);
    lerpPos.y = posApos.y + mu * (posBpos.y - posApos.y);
    lerpPos.z = posApos.z + mu * (posBpos.z - posApos.z);

    // console.log("IM IN VERTEX INTERP: ");
    // console.log(lerpPos);

    return lerpPos;
  }

  polygonize(isolevel, metaBallsList) {

    // @TODO

    // console.log("IM IN POLYGONIZE");
    // console.log("Metaballs list length: ");
    // console.log(metaBallsList.length);

    var vertexList = [];
    var normalList = [];

    //output arrays
    var vertPositions = [];
    var vertNormals = [];

    var cubeIndex = 0;
    //figure out the cubeIndex for the edge table
    //to figure out which edges are being intersected
    //|= --> bitwise or
    //EX --> 5 | 1 --> 0101 | 0001 --> 0101 (anywhere there's a 1, result will be 1)

    // console.log(this.BLowerLeft.isovalue);
    // console.log(this.BLowerRight.isovalue);
    // console.log(this.FLowerRight.isovalue);
    // console.log(this.FLowerLeft.isovalue);
    //
    // console.log(this.BUpperLeft.isovalue);
    // console.log(this.BUpperRight.isovalue);
    // console.log(this.FUpperRight.isovalue);
    // console.log(this.FUpperLeft.isovalue);
    //
    // console.log(isolevel);
    if(this.BLowerLeft.isovalue < isolevel) {cubeIndex |= 1;}   //grid[0]
    if(this.BLowerRight.isovalue < isolevel) {cubeIndex |= 2;}  //grid[1]
    if(this.FLowerRight.isovalue < isolevel) {cubeIndex |= 4;}  //grid[2]
    if(this.FLowerLeft.isovalue < isolevel) {cubeIndex |= 8;}   //grid[3]
    if(this.BUpperLeft.isovalue < isolevel) {cubeIndex |= 16;}  //grid[4]
    if(this.BUpperRight.isovalue < isolevel) {cubeIndex |= 32;} //grid[5]
    if(this.FUpperRight.isovalue < isolevel) {cubeIndex |= 64;} //grid[6]
    if(this.FUpperLeft.isovalue < isolevel) {cubeIndex |= 128;} //grid[7]

    // console.log("CUBE INDEX: " + cubeIndex);

    //FIND OUT WHICH BITS OF EDGETABLE VALUE TO RUN VERTEXINTERPOLATION ON
    //if cubeIndex == 9, edgetable[9] = 1001 0000 0101
    //if 1001 0000 0101 has a first bit, then run vertexInterpolation

    //cube is completely inside or outside the isosurface
    if(LUT.EDGE_TABLE[cubeIndex] == 0)
    {
      //return 0;
      // vertPositions = [];
      // vertNormals = [];
      return {
        vertPositions: vertPositions,
        vertNormals: vertNormals
      };
    }
    if(LUT.EDGE_TABLE[cubeIndex] & 1)
    {
      var pt1 = this.vertexInterpolation(isolevel, this.BLowerLeft, this.BLowerRight);
      // vertexList.push(pt1);
      // var nor1 = this.calculateNormal(pt1, metaBallsList);
      // normalList.push(nor1);
      vertexList[0] = pt1;
      normalList[0] = this.calculateNormal(pt1, metaBallsList);
    }   //0, 1
    if(LUT.EDGE_TABLE[cubeIndex] & 2)
    {
      var pt2 = this.vertexInterpolation(isolevel, this.BLowerRight, this.FLowerRight);
      // vertexList.push(pt2);
      // var nor2 = this.calculateNormal(pt2, metaBallsList);
      // normalList.push(nor2);
      vertexList[1] = pt2;
      normalList[1] = this.calculateNormal(pt2, metaBallsList);
    }  //1, 2
    if(LUT.EDGE_TABLE[cubeIndex] & 4)
    {
      var pt3 = this.vertexInterpolation(isolevel, this.FLowerRight, this.FLowerLeft);
      // vertexList.push(pt3);
      // var nor3 = this.calculateNormal(pt3, metaBallsList);
      // normalList.push(nor3);
      vertexList[2] = pt3;
      normalList[2] = this.calculateNormal(pt3, metaBallsList);
    }   //2, 3
    if(LUT.EDGE_TABLE[cubeIndex] & 8)
    {
      var pt4 = this.vertexInterpolation(isolevel, this.FLowerLeft, this.BLowerLeft);
      // vertexList.push(pt4);
      // var nor4 = this.calculateNormal(pt4, metaBallsList);
      // normalList.push(nor4);
      vertexList[3] = pt4;
      normalList[3] = this.calculateNormal(pt4, metaBallsList);
    }    //3, 0
    if(LUT.EDGE_TABLE[cubeIndex] & 16)
    {
      var pt5 = this.vertexInterpolation(isolevel, this.BUpperLeft, this.BUpperRight);
      // vertexList.push(pt5);
      // var nor5 = this.calculateNormal(pt5, metaBallsList);
      // normalList.push(nor5);
      vertexList[4] = pt5;
      normalList[4] = this.calculateNormal(pt5, metaBallsList);
    }  //4, 5
    if(LUT.EDGE_TABLE[cubeIndex] & 32)
    {
      var pt6 = this.vertexInterpolation(isolevel, this.BUpperRight, this.FUpperRight);
      // vertexList.push(pt6);
      // var nor6 = this.calculateNormal(pt6, metaBallsList);
      // normalList.push(nor6);
      vertexList[5] = pt6;
      normalList[5] = this.calculateNormal(pt6, metaBallsList);
    } //5,6
    if(LUT.EDGE_TABLE[cubeIndex] & 64)
    {
      var pt7 = this.vertexInterpolation(isolevel, this.FUpperRight, this.FUpperLeft);
      // vertexList.push(pt7);
      // var nor7 = this.calculateNormal(pt7, metaBallsList);
      // normalList.push(nor7);
      vertexList[6] = pt7;
      normalList[6] = this.calculateNormal(pt7, metaBallsList);
    }  //6, 7
    if(LUT.EDGE_TABLE[cubeIndex] & 128)
    {
      var pt8 = this.vertexInterpolation(isolevel, this.BUpperLeft, this.FUpperLeft);
      // vertexList.push(pt8);
      // var nor8 = this.calculateNormal(pt8, metaBallsList);
      // normalList.push(nor8);
      vertexList[7] = pt8;
      normalList[7] = this.calculateNormal(pt8, metaBallsList);
    }  //7, 4
    if(LUT.EDGE_TABLE[cubeIndex] & 256)
    {
      var pt9 = this.vertexInterpolation(isolevel, this.BLowerLeft, this.BUpperLeft);
      // vertexList.push(pt9);
      // var nor9 = this.calculateNormal(pt9, metaBallsList);
      // normalList.push(nor9);
      vertexList[8] = pt9;
      normalList[8] = this.calculateNormal(pt9, metaBallsList);
    }  //0, 4
    if(LUT.EDGE_TABLE[cubeIndex] & 512)
    {
      var pt10 = this.vertexInterpolation(isolevel, this.BLowerRight, this.BUpperRight);
      // vertexList.push(pt10);
      // var nor10 = this.calculateNormal(pt10, metaBallsList);
      // normalList.push(nor10);
      vertexList[9] = pt10;
      normalList[9] = this.calculateNormal(pt10, metaBallsList);
    }  //1, 5
    if(LUT.EDGE_TABLE[cubeIndex] & 1024)
    {
      var pt11 = this.vertexInterpolation(isolevel, this.FLowerRight, this.FUpperRight);
      // vertexList.push(pt11);
      // var nor11 = this.calculateNormal(pt11, metaBallsList);
      // normalList.push(nor11);
      vertexList[10] = pt11;
      normalList[10] = this.calculateNormal(pt11, metaBallsList);
    }  //2, 6
    if(LUT.EDGE_TABLE[cubeIndex] & 2048)
    {
      var pt12 = this.vertexInterpolation(isolevel, this.FLowerLeft, this.FUpperLeft);
      // vertexList.push(pt12);
      // var nor12 = this.calculateNormal(pt12, metaBallsList);
      // normalList.push(nor12);
      vertexList[11] = pt12;
      normalList[11] = this.calculateNormal(pt12, metaBallsList);
    }  //3, 7

    // console.log("IM HERE AFTER 15 IF STATEMENTS");

    // var currTriTableRow = LUT.TRI_TABLE[cubeIndex];
    // console.log(currTriTableRow);

    // console.log("IM PRINTING THE VERT LIST AFTER INTERPOLATING: ");
    // console.log(vertexList);


    //var tri = LUT.TRI_TABLE[cubeIndex * 16 + j];
    for(var i = 0; LUT.TRI_TABLE[cubeIndex * 16 + i] != -1; i += 3)//for(var i = 0; i < 16; i += 3)
    {
      // if(LUT.TRI_TABLE[cubeIndex * 16 + i] != -1)
      // {
        //get the 3 triangle points and put them in vertPositions

        // console.log("IM IN OKAY TRI TABLE CASE: ");
        // console.log(LUT.TRI_TABLE[cubeIndex * 16 + i]);

        var p1 = vertexList[LUT.TRI_TABLE[cubeIndex * 16 + i]];
        var p2 = vertexList[LUT.TRI_TABLE[cubeIndex * 16 + i + 1]];
        var p3 = vertexList[LUT.TRI_TABLE[cubeIndex * 16 + i + 2]];
        vertPositions.push(p1);
        vertPositions.push(p2);
        vertPositions.push(p3);

        //do the same thing for normals
        var n1 = normalList[LUT.TRI_TABLE[cubeIndex * 16 + i]];
        var n2 = normalList[LUT.TRI_TABLE[cubeIndex * 16 + i + 1]];
        var n3 = normalList[LUT.TRI_TABLE[cubeIndex * 16 + i + 2]];
        vertNormals.push(n1);
        vertNormals.push(n2);
        vertNormals.push(n3);
      // }
    }//end for loop

    // console.log("IM HERE AFTER TRIANGLE FOR LOOP");
    // console.log("PRINTING VERT POSITIONS: ")
    // console.log(vertPositions);

    return {
      vertPositions: vertPositions,
      vertNormals: vertNormals
    };
  };

  calculateNormal(point, ballList)
  {
    //console.log("IM IN CALCULATE NORMAL");
    var grad = new THREE.Vector3(0.0, 0.0, 0.0);
    var offset = 0.0001;

    var p1x = new THREE.Vector3(point.x + offset, point.y, point.z);
    var p2x = new THREE.Vector3(point.x - offset, point.y, point.z);
    grad.x = this.sampleNormal(p1x, ballList) - this.sampleNormal(p2x, ballList);

    var p1y = new THREE.Vector3(point.x, point.y + offset, point.z);
    var p2y = new THREE.Vector3(point.x, point.y - offset, point.z);
    grad.y = this.sampleNormal(p1y, ballList) - this.sampleNormal(p2y, ballList);

    var p1z = new THREE.Vector3(point.x, point.y, point.z + offset);
    var p2z = new THREE.Vector3(point.x, point.y, point.z - offset);
    grad.z = this.sampleNormal(p1z, ballList) - this.sampleNormal(p2z, ballList);

    //var _len = grad.length();
    //var outputNormal = new THREE.Vector3(-grad.x / _len, -grad.y / _len, -grad.z / _len);
    //return outputNormal;
    return grad.normalize();
  };

  sampleNormal(point, _ballList)
  {
    //console.log("IM IN SAMPLENORMAL");
    var isovalue = 0.0;
    //var pt = new THREE.Vector3(point[0], point[1], point[2])

    for(var i = 0; i < _ballList.length; i++)
    {
      var currBall = _ballList[i];
      var dist = Math.sqrt(Math.pow(currBall.pos.x - point.x, 2) + Math.pow(currBall.pos.y - point.y, 2) + Math.pow(currBall.pos.z - point.z, 2));

      isovalue += ((currBall.radius * currBall.radius) / (dist * dist));
    }
    return isovalue;
  };
}
