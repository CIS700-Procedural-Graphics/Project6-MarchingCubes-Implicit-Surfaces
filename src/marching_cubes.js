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

    //TEST
    this.voxels[0].polygonize(this.isolevel);
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
  influence(ball, point){
    var rSquared = Math.pow(ball.radius, 2.0);
    var xDiffSquared = Math.pow(point.x - ball.pos.x, 2.0);
    var yDiffSquared = Math.pow(point.y - ball.pos.y, 2.0);
    var zDiffSquared = Math.pow(point.z - ball.pos.z, 2.0);
    return (rSquared/(xDiffSquared + yDiffSquared + zDiffSquared));
  };

  sample(point) {
    // @TODO
    var isovalue = 0.0;

    // var i = this.influence(this.balls[0], point);

    for (var i = 0; i < this.balls.length; i++){
      isovalue += this.influence(this.balls[i], point);
    }

    // isovalue = 1.1;

    return isovalue;
  }

  averageIso(voxel){
    var sum = 
    voxel.v1.isovalue + voxel.v2.isovalue
    + voxel.v3.isovalue + voxel.v4.isovalue
    + voxel.v5.isovalue + voxel.v6.isovalue
    + voxel.v7.isovalue + voxel.v8.isovalue;
    return sum/8.0;
  }

  update() {

    if (this.isPaused) {
      return;
    }

    // This should move the metaballs
    this.balls.forEach(function(ball) {
      ball.update();
    });

    for (var c = 0; c < this.res3; c++) {

      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);
      //Sampling the corner points
      this.voxels[c].v1.isovalue = this.sample(this.voxels[c].v1.pos);
      this.voxels[c].v2.isovalue = this.sample(this.voxels[c].v2.pos);
      this.voxels[c].v3.isovalue = this.sample(this.voxels[c].v3.pos);
      this.voxels[c].v4.isovalue = this.sample(this.voxels[c].v4.pos);
      this.voxels[c].v5.isovalue = this.sample(this.voxels[c].v5.pos);
      this.voxels[c].v6.isovalue = this.sample(this.voxels[c].v6.pos);
      this.voxels[c].v7.isovalue = this.sample(this.voxels[c].v7.pos);
      this.voxels[c].v8.isovalue = this.sample(this.voxels[c].v8.pos);

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {
        
        // Toggle voxels on or off
        // if (this.averageIso(this.voxels[c]) > this.isolevel) {
        if (this.voxels[c].center.isovalue > this.isolevel) {
          this.voxels[c].show();
        } else {
          this.voxels[c].hide();
        }
        // this.voxels[c].center.updateLabel(this.camera);
        this.voxels[c].v1.updateLabel(this.camera);
        this.voxels[c].v2.updateLabel(this.camera);
        this.voxels[c].v3.updateLabel(this.camera);
        this.voxels[c].v4.updateLabel(this.camera);
        this.voxels[c].v5.updateLabel(this.camera);
        this.voxels[c].v6.updateLabel(this.camera);
        this.voxels[c].v7.updateLabel(this.camera);
        this.voxels[c].v8.updateLabel(this.camera);


      } else {
        this.voxels[c].center.clearLabel();
        this.voxels[c].v1.clearLabel();
        this.voxels[c].v2.clearLabel();
        this.voxels[c].v3.clearLabel();
        this.voxels[c].v4.clearLabel();
        this.voxels[c].v5.clearLabel();
        this.voxels[c].v6.clearLabel();
        this.voxels[c].v7.clearLabel();
        this.voxels[c].v8.clearLabel();



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

  makeMesh() {
    // @TODO
  }

  updateMesh() {
    // @TODO
  }  
};

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

    //Create labels at corners 
    //See http://mathstat.slu.edu/escher/upload/thumb/6/69/Cube-labeled.svg/300px-Cube-labeled.svg.png
    var v1x = x - halfGridCellWidth;
    var v1y = y + halfGridCellWidth;
    var v1z = z - halfGridCellWidth;
    this.v1 = new InspectPoint(new THREE.Vector3(v1x, v1y, v1z), 0, VISUAL_DEBUG);

    var v2x = v1x;
    var v2y = v1y;
    var v2z = z + halfGridCellWidth;
    this.v2 = new InspectPoint(new THREE.Vector3(v2x, v2y, v2z), 0, VISUAL_DEBUG);

    var v3x = x + halfGridCellWidth;
    var v3y = v2y;
    var v3z = v2z;
    this.v3 = new InspectPoint(new THREE.Vector3(v3x, v3y, v3z), 0, VISUAL_DEBUG);

    var v4x = v3x;
    var v4y = v3y;
    var v4z = v1z;
    this.v4 = new InspectPoint(new THREE.Vector3(v4x, v4y, v4z), 0, VISUAL_DEBUG);

    var v5x = v1x;
    var v5y = y - halfGridCellWidth;
    var v5z = v1z;
    this.v5 = new InspectPoint(new THREE.Vector3(v5x, v5y, v5z), 0, VISUAL_DEBUG);

    var v6x = v5x;
    var v6y = v5y;
    var v6z = v2z;
    this.v6 = new InspectPoint(new THREE.Vector3(v6x, v6y, v6z), 0, VISUAL_DEBUG);

    var v7x = v3x;
    var v7y = v6y;
    var v7z = v6z;
    this.v7 = new InspectPoint(new THREE.Vector3(v7x, v7y, v7z), 0, VISUAL_DEBUG);

    var v8x = v7x;
    var v8y = v7y;
    var v8z = v4z;
    this.v8 = new InspectPoint(new THREE.Vector3(v8x, v8y, v8z), 0, VISUAL_DEBUG);

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

    if (this.v1){
      this.v1.clearLabel();
    }
    
    if(this.v2){
      this.v2.clearLabel();
    }
    
    if(this.v3){
      this.v3.clearLabel();
    }
    
    if(this.v4){
      this.v4.clearLabel();
    }

    if(this.v5){
      this.v5.clearLabel();
    }

    if(this.v6){
      this.v6.clearLabel();
    }

    if(this.v7){
      this.v7.clearLabel();
    }
    
    if(this.v8){
      this.v8.clearLabel();
    }
  }

  vertexInterpolation(isolevel, posA, posB) {

    // @TODO
    var lerpPos;
    return lerpPos;
  }

  polygonize(isolevel) {

    // @TODO

    var vertexList = [];
    var normalList = [];

    var edgeTable = LUT.EDGE_TABLE;

   
   /*
      Determine the index into the edge table which
      tells us which vertices are inside of the surface
   */
   //WARNING: might have to re-name voxel vertices to match Paul's figure
   var cubeindex = 0;
          
   var v1 = this.v1;
   var v2 = this.v2;
   var v3 = this.v3;
   var v4 = this.v4;
   var v5 = this.v5;
   var v6 = this.v6;
   var v7 = this.v7;
   var v8 = this.v8;

   if (v1.isovalue < isolevel) cubeindex |= 1;
   if (v2.isovalue < isolevel) cubeindex |= 2;
   if (v3.isovalue < isolevel) cubeindex |= 4;
   if (v4.isovalue < isolevel) cubeindex |= 8;
   if (v5.isovalue < isolevel) cubeindex |= 16;
   if (v6.isovalue < isolevel) cubeindex |= 32;
   if (v7.isovalue < isolevel) cubeindex |= 64;
   if (v8.isovalue < isolevel) cubeindex |= 128;
   
        /* Cube is entirely in/out of the surface */
   if (edgeTable[cubeindex] == 0)
      return(0);

    /* Find the vertices where the surface intersects the cube */
   if (edgeTable[cubeindex] & 1)
      vertexList[0] =
         vertexInterpolation(isolevel,v1,v2);
   if (edgeTable[cubeindex] & 2)
      vertexList[1] =
         vertexInterpolation(isolevel,v2,v3);
   if (edgeTable[cubeindex] & 4)
      vertexList[2] =
         vertexInterpolation(isolevel,v3,v4);
   if (edgeTable[cubeindex] & 8)
      vertexList[3] =
         vertexInterpolation(isolevel,v4,v1);
   if (edgeTable[cubeindex] & 16)
      vertexList[4] =
         vertexInterpolation(isolevel,v5,v6);
   if (edgeTable[cubeindex] & 32)
      vertexList[5] =
         vertexInterpolation(isolevel,v6,v7);
   if (edgeTable[cubeindex] & 64)
      vertexList[6] =
         vertexInterpolation(isolevel,v7,v8);
   if (edgeTable[cubeindex] & 128)
      vertexList[7] =
         vertexInterpolation(isolevel,v8,v5);
   if (edgeTable[cubeindex] & 256)
      vertexList[8] =
         vertexInterpolation(isolevel,v1,v5);
   if (edgeTable[cubeindex] & 512)
      vertexList[9] =
         vertexInterpolation(isolevel,v2,v6);
   if (edgeTable[cubeindex] & 1024)
      vertexList[10] =
         vertexInterpolation(isolevel,v3,v7);
   if (edgeTable[cubeindex] & 2048)
      vertexList[11] =
         vertexInterpolation(isolevel,v4,v8);

    return {
      vertPositions: vertPositions,
      vertNormals: vertNormals
    };
  };
}