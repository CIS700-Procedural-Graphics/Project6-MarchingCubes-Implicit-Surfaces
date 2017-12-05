const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );

var first = true;
var numMetaballs = 0;
var balls = [];

export default class MarchingCubes {

  constructor(App) {      
    this.init(App);
  }

  updateBalls() {
    this.myBalls = balls;
  }

  hideBall(i) {
    balls[i].hide();
  }

  showBall(i) {
    balls[i].show();
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
    numMetaballs = App.config.numMetaballs; //------------------------------------------------------------------------

    this.camera = App.camera;
    this.scene = App.scene;

    this.voxels = [];
    this.labels = [];
    balls = [];
    this.myBalls = []; // the this version of balls array of metaballs - only used for the app

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

    this.usingMesh = this.makeMesh();
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

    balls = [];

    var x, y, z, vx, vy, vz, radius, pos, vel;
    var matLambertWhite = LAMBERT_WHITE;
    var maxRadiusTRippled = this.maxRadius * 3;
    var maxRadiusDoubled = this.maxRadius * 2;

    // Randomly generate metaballs with different sizes and velocities
    for (var i = 0; i < numMetaballs; i++) {
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
      balls.push(ball);
      
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
    for (var i = 0; i < numMetaballs; i++) {
      var ball = balls[i];

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
    balls.forEach(function(ball) {
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
    //console.log("calculated all voxel samples");
    this.updateMesh(); //-----------------------------------------------
    //console.log("updated mesh based on polygonized values");
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
    /********************************************************************************************************/
    // -- instead of rebuilding from geo in update mesh - make mesh here for a random triangle
    // -- and update that in update mesh so that it's not associated with currVoxel / cubes
    /********************************************************************************************************/

    var currGeo = new THREE.Geometry();
    currGeo.dynamic = true;
    var redMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000, transparent: true, opacity: 1, side: THREE.DoubleSide });

    var workingMaterial = new THREE.ShaderMaterial({
      vertexShader: require('./shaders/my-vert.glsl'),
      fragmentShader: require('./shaders/my-frag.glsl')
    }); //-HB

    var m = new THREE.Mesh( currGeo, redMaterial );
    m.position.set(0.0, 0.0, 0.0);

    this.scene.add(m);

    return m;
  }

  updateMesh() {
    // for each voxel - call polygonize(this.isolevel);
    // update their vertex positions and normals?
    // use normals for coloring the mesh based on material

    // MY ACTUAL STUFF
    
    //console.log(this.voxels.length);
    var verticesGeo = [];
    var facesGeo = [];
    var normalsGeo = [];
    for (var i = 0; i < this.voxels.length; i++) {
      // positions, normals = voxels[i].polygonize(this.isolevel);

      var polyData = this.voxels[i].polygonize(this.isolevel);

      for (var j = 0; j < polyData.vertPositions.length; j++) {
        verticesGeo.push(polyData.vertPositions[j]);
        normalsGeo.push(polyData.vertNormals[j]);
        
      }

    }
    this.usingMesh.geometry.vertices = verticesGeo;

    // faces and faces normals
    for (var i = 0; i < this.usingMesh.geometry.vertices.length; i += 3) {
      facesGeo.push( new THREE.Face3(i, i+1, i+2));
      facesGeo[facesGeo.length - 1].vertexNormals = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0)];
    }

    this.usingMesh.geometry.faces = facesGeo;

    //bc computing vertex normals
    this.usingMesh.geometry.computeVertexNormals();
  
    // update for new geometry
    this.usingMesh.geometry.verticesNeedUpdate = true;
    this.usingMesh.geometry.elementsNeedUpdate = true;


    if (first) { first = false; }

    // note: since geo is updated - green mesh and white wireframe should both update.
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

  // -HB : for calculating normals
  sampleForNormals(point) {
    // f(pointInfluence) = (r^2)/d^2;

    var isoVal = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    var epsilon = 0.00001;
    for (var i = 0; i < numMetaballs; i++) {

      var xD = /*ball.pos.x -*/ point.x;
      var yD = /*ball.pos.y -*/ point.y;
      var zD = /*ball.pos.z -*/ point.z;

      var x0 = xD + epsilon;
      var y0 = yD + epsilon;
      var z0 = zD + epsilon;
      var x1 = xD - epsilon;
      var y1 = yD - epsilon;
      var z1 = zD - epsilon;

      var distX0 = Math.sqrt(x0 * x0 + yD * yD + zD * zD);
      var distX1 = Math.sqrt(x1 * x1 + yD * yD + zD * zD);
      var distY0 = Math.sqrt(xD * xD + y0 * y0 + zD * zD);
      var distY1 = Math.sqrt(xD * xD + y1 * y1 + zD * zD);
      var distZ0 = Math.sqrt(xD * xD + yD * yD + z0 * z0);
      var distZ1 = Math.sqrt(xD * xD + yD * yD + z1 * z1);

      var rad = balls[i].radius;
      isoVal[0] += (rad * rad) / (distX0 * distX0);
      isoVal[1] += (rad * rad) / (distX1 * distX1);
      isoVal[2] += (rad * rad) / (distY0 * distY0);
      isoVal[3] += (rad * rad) / (distY1 * distY1);
      isoVal[4] += (rad * rad) / (distZ0 * distZ0);
      isoVal[5] += (rad * rad) / (distZ1 * distZ1);
    }

    var retIso = new THREE.Vector3(isoVal[0] - isoVal[1], isoVal[2] - isoVal[3], isoVal[4] - isoVal[5]);

    // note: sum must be > 1.0 to show up
    return (retIso.normalize());
  }

  // -HB : for lerping
  vertexInterpolation(isolevel, posA, posB, ip1, ip2) {
    /********************************************************************************************************/
    // compute the linearly interpolated vertex position on the edge according to the isovalue at each
    // end corner of the edge.
    /********************************************************************************************************/
    var checkWith = 0.00001;

    // just p1
    if (Math.abs(isolevel - ip1) < checkWith) {
      return posA;
    }
    // just p2
    if (Math.abs(isolevel - ip2) < checkWith) {
      return posB;
    }
    // based on diff between isovals of the points, if too close then just return one of them
    // bc almost as if the same
    if (Math.abs(ip1 - ip2) < checkWith) {
      return posA;
    }

    var p = new THREE.Vector3(0.0, 0.0, 0.0);
    var weight = (isolevel - ip1) / (ip2 - ip1);
    p.x = posA.x + weight * (posB.x - posA.x);
    p.y = posA.y + weight * (posB.y - posA.y);
    p.z = posA.z + weight * (posB.z - posA.z);

    return p;
  }


  //  http://paulbourke.net/geometry/polygonise/
  polygonize(isoLevel) {
    /********************************************************************************************************/
    // compute the vertex positions based on intersected edges and isovals. from these created polygons
    // compute the associated normals as well.
    /********************************************************************************************************/

    // temp holders
    var vertList = new Array();
    var normList = new Array();

    // figure out cell configuration based isoVals versus isoLevel
    var pickCube = 0;
    for (var i = 0; i < 8; i++) {
      if (this.samples[i] > isoLevel) {
        pickCube += Math.pow(2, i);
      }
    }

    // finding vertices where cube intersects
    // if cube index is 0 then no vertices returned [cube entirely in/out of the visual area so not shown]
    if (pickCube == 0) {
      return {
        vertPositions: vertList,
        vertNormals: normList
      };
    }

    // GIVEN POSITIONS
    var c = new THREE.Vector3(0.0, 0.0, 0.0);
    c = this.pos;
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

    var indexLocs = [
      0, 1, 1, 2, 
      2, 3, 3, 0, 
      4, 5, 5, 6,  
      6, 7, 7, 4,
      0, 4, 1, 5,
      2, 6, 3, 7 ];

    // i goes from [0, 11] bc going through all poss bits
    var twelveBits = LUT.EDGE_TABLE[pickCube];

    
    var lerpingVals = new Array();

    var j = 0;
    for (var i = 0; i < 12; i++) {
      if (twelveBits & Math.pow(2, i)) {
        var i_curr = indexLocs[j];
        var i_next = indexLocs[j+1];

        lerpingVals[i] = this.vertexInterpolation(isoLevel,
                                                  allPoints[i_curr],
                                                  allPoints[i_next],
                                                  this.samples[i_curr],
                                                  this.samples[i_next]);
      }

      j += 2;
    }//end: forLoop over 12bits

    // looping for vertex and normal list positions
    for (var i = 0; LUT.TRI_TABLE[pickCube * 16 + i] != -1; i += 1) {
      var loc1 = lerpingVals[LUT.TRI_TABLE[pickCube * 16 + i]];
      vertList.push(loc1);
      normList.push(this.sampleForNormals(loc1));
    }

    return {
      vertPositions: vertList,
      vertNormals: normList
    };
  };
   
}