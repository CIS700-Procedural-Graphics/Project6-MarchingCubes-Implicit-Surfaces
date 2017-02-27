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

    // -HB : added to calc samples at corners
    this.calcAllVoxelSamples();

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

  // -HB
  // performed for each voxel
  calcAllVoxelSamples() {
    /********************************************************************************************************/
    // In order to polygonize a voxel, generate new samples at each corner of the voxel. Their isovalues must
    // be updated as the metaball function changes due of metaballs moving.
    /********************************************************************************************************/

    for (var i = 0; i < this.voxels.length; i++) {
      var c = new THREE.Vector3(0.0, 0.0, 0.0);
      c = this.voxels[i].pos;
      var hW = this.gridCellWidth / 2.0;

      var allPoints = new Array();

      var cx = c.x;
      var cy = c.y;
      var cz = c.z;
      allPoints.push( new THREE.Vector3(cx-hW, cy-hW, cz+hW), // bottom face: 0, 1, 2, 3
                      new THREE.Vector3(cx+hW, cy-hW, cz+hW),
                      new THREE.Vector3(cx+hW, cy-hW, cz-hW),
                      new THREE.Vector3(cx-hW, cy-hW, cz-hW),
                      new THREE.Vector3(cx-hW, cy+hW, cz+hW), // top face: 4, 5, 6, 7
                      new THREE.Vector3(cx+hW, cy+hW, cz+hW),
                      new THREE.Vector3(cx+hW, cy+hW, cz-hW),
                      new THREE.Vector3(cx-hW, cy+hW, cz-hW));

      var samp = new Array();

      for (var j = 0; j < allPoints.length; j++) {
        samp.push(this.sample(allPoints[j]));
      }

      this.voxels[i].samples = samp;
    }
  }

  // This function samples a point from the metaball's density function
  // Implement a function that returns the value of the all metaballs influence to a given point.
  // Please follow the resources given in the write-up for details.
  sample(point) {
    // f(pointInfluence) = (r^2)/d^2;

    var isoVal = 0.0;
    for (var i = 0; i < this.numMetaballs; i++) {
      var ball = this.balls[i];

      var xD = ball.pos.x - point.x;
      var yD = ball.pos.y - point.y;
      var zD = ball.pos.z - point.z;

      var dist = Math.sqrt(xD * xD + yD * yD + zD * zD);
      var rad = ball.radius;
      isoVal += (rad * rad) / (dist * dist);
    }

    // note: sum must be > 1.0 to show up
    return isoVal;
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

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {
        
        // Toggle voxels on or off
        if (this.voxels[c].center.isovalue > this.isolevel) {
          this.voxels[c].show();
        } else {
          this.voxels[c].hide();
        }
        this.voxels[c].center.updateLabel(this.camera);
      } else {
        this.voxels[c].center.clearLabel();
      }
    }

    // -HB : added to calc samples at corners
    this.calcAllVoxelSamples();

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

    //-HB: added to be the sample value at each corner
    // to initialize: filling with 8 items so array.length is 8
    this.samples = new Array();
    for (var i = 0; i < 8; i++) {
      this.samples.push(0.0);
    } 
    // ^ samples is filled with approp values in update in MarchingCubes  
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

  // -HB : for lerping
  vertexInterpolation(isolevel, posA, ip1, ip2, posB) {
    /********************************************************************************************************/
    // compute the linearly interpolated vertex position on the edge according to the isovalue at each
    // end corner of the edge.
    /********************************************************************************************************/
    var checkWith = 0.00001;

    // just p1
    if (Math.abs(isoLevel - iv1) < checkWith) {
      return p1;
    }
    // just p2
    if (Math.abs(isoLevel - iv2) < checkWith) {
      return p2;
    }
    // based on diff between isovals of the points, if too close then just return one of them
    // bc almost as if the same
    if (Math.abs(iv1 - iv2) < checkWith) {
      return p1;
    }

    var p = Vector3f(0.0, 0.0, 0.0, 0.0);
    var weight = (isoLevel - iv1) / (iv2 - iv1);
    p.x = p1.x + weight * (p2.x - p1.x);
    p.y = p1.y + weight * (p2.y - p1.y);
    p.z = p1.z + weight * (p2.z - p1.z);

    return p;
  }


  //  http://paulbourke.net/geometry/polygonise/
  polygonize(isolevel) {

    // @TODO
    var vertexList = [];
    var normalList = [];


    // figure out cell configuration based isoVals versus isoLevel
    var pickCube = 0;
    for (var i = 0; i < 8; i++) {
      if (this.samples[i] < isoLevel) {
        pickCube += Math.pow(2, i);
      }
    }

    // finding vertices where cube intersects
    // if cube index is 0 then no vertices returned [cube entirely in/out of the visual area so not shown]
    if (pickCube == 0) {
      return 0; // NOT SURE HOW TO PROPERLY HANDLE THIS CASE????
      // NOT SURE HOW TO PROPERLY HANDLE THIS CASE????
      // NOT SURE HOW TO PROPERLY HANDLE THIS CASE????
      // NOT SURE HOW TO PROPERLY HANDLE THIS CASE????
      // NOT SURE HOW TO PROPERLY HANDLE THIS CASE????
      // NOT SURE HOW TO PROPERLY HANDLE THIS CASE????
    }

    // stores list of vertices but not of them in triangle format
    var vertexLocations = [];

    // c = col, r = row = which face
    // c = (i) % 4;
    // r = floor(i+1 / 4)

    // i goes from [0, 11] bc going through all poss bits
    var twelveBits = this.EDGE_TABLE[pickCube];
    for (var i = 0; i < 12; i++) {
      // based on if the bit config returned by the cubeTable for pickCube, if there's a bit for a loc, then 
      // there's an intersection on that edge so we need to interp the vertex location and add it to the verPositions
      // output array
      if (twelveBits & Math.pow(2, i)) {
        // to get proper index for this interp: 
        var c = i % 4;
        var r = Math.floor((i+1) / 4);
        var idx = r * 4 + c;

        // lerp vertices in this configuration based on isovals at each point for each face in found cell configuration 
        vertexLocations[i] = this.interp(this.positions[idx],
                                         this.positions[idx+1],
                                         this.samples[idx],
                                         this.samples[idx + 1]);
      }
    }//end: forLoop over 12bits

    // now have vertex locations for all edge intersections - ie what our final geo will be built with
    // need to make triangles out of these now
    var currTri = 0;
    // iterate through the current tri_table row and fill out triangles until you reach -1 which means there are no longer
    //    triangles to be filled for this orientation
    for (var i = 0; this.TRI_TABLE[pickCube][i] != -1; i += 3) {
        vertexList[currTri] = THREE.Vector3f(vertexLocations[this.TRI_TABLE[pickCube][i]],
                                             vertexLocations[this.TRI_TABLE[pickCube][i]],
                                             vertexLocations[this.TRI_TABLE[pickCube][i]] );
        currTri += 1;
    }

    // calculating normals
    // for each vertex - find average of the normals of all attached faces but calculate the overall normal for the point
    //    such that the weighting used for each normals addition to the calculation is based on 1/SA of the associated face
    // since for the assignment not focused on implementation speed
    //    make listing of which vertices touch which faces and just calculate for each vertex then put in
    


    

    

    return {
      vertPositions: vertPositions,
      vertNormals: vertNormals
    };
  };
}