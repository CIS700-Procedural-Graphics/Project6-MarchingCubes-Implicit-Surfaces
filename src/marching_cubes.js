const THREE = require('three');
import {silverTexture} from './textures'

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;
var episolon = 0.1;
var balls = [];

var options = {lightColor: '#ffffff',lightIntensity: 1,ambient: '#111111',texture: null};

// lava
var l_mat = {
  uniforms: {
    texture: {type: "t",value: null},
    u_ambient: {type: 'v3',value: new THREE.Color(options.ambient)},
    u_lightCol: {type: 'v3',value: new THREE.Color(options.lightColor)},
    u_lightIntensity: {type: 'f',value: options.lightIntensity}
  },
  vertexShader: require('./shaders/lava-vert.glsl'),
  fragmentShader: require('./shaders/lava-frag.glsl')
};

const LAVA_MAT = new THREE.ShaderMaterial(l_mat);
const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0x111111, emissive: 0xff0000 });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );

// This function samples a point from the metaball's density function
// Implement a function that returns the value of the all metaballs influence to a given point.
// Please follow the resources given in the write-up for details.
function sample(point) {
  var isovalue = 0.0;
  for (var i = 0; i < balls.length; i ++) {
    var r = balls[i].radius;
    var d = point.distanceTo(balls[i].pos);
    isovalue += (r * r / (d * d)) * balls[i].neg;
  }
  return isovalue;
}

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
    this.gridCellHeight = App.config.gridCellHeight;
    this.gridCellDepth = App.config.gridCellDepth;
    this.halfCellWidth = App.config.gridCellWidth / 2.0;
    this.halfCellHeight = App.config.gridCellHeight / 2.0;
    this.halfCellDepth = App.config.gridCellDepth / 2.0;
    this.gridWidth = App.config.gridWidth;
    this.gridHeight = App.config.gridHeight;
    this.gridDepth = App.config.gridDepth;

    this.res = App.config.gridRes;
    this.res2 = App.config.gridRes * App.config.gridRes;
    this.res3 = App.config.gridRes * App.config.gridRes * App.config.gridRes;

    this.maxSpeedX = App.config.maxSpeedX;
    this.maxSpeedY = App.config.maxSpeedY;
    this.maxSpeedZ = App.config.maxSpeedZ;
    this.numMetaballs = App.config.numMetaballs;

    this.camera = App.camera;
    this.scene = App.scene;

    this.voxels = [];
    //this.labels = [];
    this.balls = balls;

    this.showSpheres = true;
    this.showGrid = true;

    silverTexture.then(function(texture) {
        l_mat.uniforms.texture.value = texture;
    });

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
      i3[1] * this.gridCellHeight + this.origin.y + this.halfCellHeight,
      i3[2] * this.gridCellDepth + this.origin.z + this.halfCellDepth
    );
  };

  setupCells() {

    // Allocate voxels based on our grid resolution
    this.voxels = [];
    for (var i = 0; i < this.res3; i++) {
      var i3 = this.i1toi3(i);
      var {x, y, z} = this.i3toPos(i3);
      var voxel = new Voxel(new THREE.Vector3(x, y, z), this.gridCellWidth, this.gridCellHeight, this.gridCellDepth);
      this.voxels.push(voxel);

      if (VISUAL_DEBUG) {
        this.scene.add(voxel.wireframe);
        this.scene.add(voxel.mesh);
      }
    }
  }

  setupMetaballs() {

    var x, y, z, vx, vy, vz, radius, pos, vel;
    var matLambertWhite = LAMBERT_WHITE;
    var maxRadiusTRippled = this.maxRadius * 3;
    var maxRadiusDoubled = this.maxRadius * 2;

    // Randomly generate metaballs with different sizes and velocities
    for (var i = 0; i < this.numMetaballs; i++) {
      x = this.gridWidth / 2;
      y = this.gridHeight / 2;
      z = this.gridDepth / 2;
      pos = new THREE.Vector3(3, 3, 3);

      vx = (Math.random() * 2 - 1) * this.maxSpeedX;
      vy = (Math.random() * 2 - 1) * this.maxSpeedY;
      vz = (Math.random() * 2 - 1) * this.maxSpeedZ;
      vel = new THREE.Vector3(vx, vy, vz);

      radius = Math.random() * (this.maxRadius - this.minRadius) + this.minRadius;
      var neg = 1;
      if (Math.random()>0.75) neg = -1;
      var ball = new Metaball(pos, radius, vel, neg, this.gridWidth, this.gridHeight, this.gridDepth, VISUAL_DEBUG);
      balls.push(ball);

      // if (VISUAL_DEBUG) {
      //   this.scene.add(ball.mesh);
      // }
    }
    this.balls = balls;
  }

  update() {

    if (this.isPaused) {
      return;
    }

    // This should move the metaballs
    balls.forEach(function(ball) {
      ball.update();
    });
    this.balls = balls;

    for (var c = 0; c < this.res3; c++) { // every voxel

      // Sampling the center and vertex points
      this.voxels[c].center.isovalue = sample(this.voxels[c].center.pos);
      for (var i = 0; i < 8; i ++) {
        this.voxels[c].corners[i].isovalue = sample(this.voxels[c].corners[i].pos);
      }

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
    var geo = new THREE.Geometry();
    this.mesh = new THREE.Mesh(geo, LAVA_MAT);
    this.mesh.geometry.dynamic = true;
    this.scene.add(this.mesh);
  }

  updateMesh() {
    // @TODO
    var vertices = [];
    var faces = [];
    var count = 0;
    for (var i = 0; i < this.res3; i ++) {
      var vox_count = 0;
      var vANDn = this.voxels[i].polygonize(this.isolevel);
      for (var j = 0; j < vANDn.vertPositions.length/3; j ++) {
        var normals = [];
        for (var k = 0; k < 3; k ++) {
          vertices.push(vANDn.vertPositions[vox_count]);
          normals.push(vANDn.vertNormals[vox_count]);
          vox_count++;
          count++;
        }
        faces.push(new THREE.Face3(count - 3, count - 2, count - 1, normals));
      }
    }
    this.mesh.geometry.vertices = vertices;
    //this.mesh.geometry.normals = normals;
    this.mesh.geometry.faces = faces;
    this.mesh.geometry.verticesNeedUpdate = true;
    this.mesh.geometry.normalsNeedUpdate = true;
    this.mesh.geometry.elementsNeedUpdate = true;
    this.mesh.geometry.computeFaceNormals();
    //console.log(this.mesh);
  }
};

// ------------------------------------------- //

class Voxel {

  constructor(position, gridCellWidth, gridCellHeight, gridCellDepth) {
    this.init(position, gridCellWidth, gridCellHeight, gridCellDepth);
  }

  init(position, gridCellWidth, gridCellHeight, gridCellDepth) {
    this.pos = position;
    this.gridCellWidth = gridCellWidth;
    this.gridCellHeight = gridCellHeight;
    this.gridCellDepth = gridCellDepth;
    this.corners = [];

    if (VISUAL_DEBUG) {
      this.makeMesh();
    }

    this.makeInspectPoints();
  }

  makeMesh() {
    var halfGridCellWidth = this.gridCellWidth / 2.0;
    var halfGridCellHeight = this.gridCellHeight / 2.0;
    var halfGridCellDepth = this.gridCellDepth / 2.0;

    var positions = new Float32Array([
      // Front face
      halfGridCellWidth, halfGridCellHeight,  halfGridCellDepth,
      halfGridCellWidth, -halfGridCellHeight, halfGridCellDepth,
      -halfGridCellWidth, -halfGridCellHeight, halfGridCellDepth,
      -halfGridCellWidth, halfGridCellHeight,  halfGridCellDepth,

      // Back face
      -halfGridCellWidth,  halfGridCellHeight, -halfGridCellDepth,
      -halfGridCellWidth, -halfGridCellHeight, -halfGridCellDepth,
      halfGridCellWidth, -halfGridCellHeight, -halfGridCellDepth,
      halfGridCellWidth,  halfGridCellHeight, -halfGridCellDepth,
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
    var w = this.gridCellWidth / 2.0;
    var h = this.gridCellHeight / 2.0;
    var d = this.gridCellDepth / 2.0;
    var x = this.pos.x;
    var y = this.pos.y;
    var z = this.pos.z;
    var red = 0xff0000;

    // Center dot
    this.center = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
    this.corners.push(new InspectPoint(new THREE.Vector3(x-w, y-h, z-d), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x+w, y-h, z-d), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x+w, y-h, z+d), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x-w, y-h, z+d), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x-w, y+h, z-d), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x+w, y+h, z-d), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x+w, y+h, z+d), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x-w, y+h, z+d), 0, VISUAL_DEBUG));
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

  vertexLerp(isolevel, posA, posB) {
    var t = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
    var lerpPos = new THREE.Vector3();
    return lerpPos.lerpVectors(posA.pos, posB.pos, t);
  }

  // returns an array of points on the cube edges
  // null if no point exists for an edge
  edgePoints(edges, x) {
    var points = [null, null, null, null, null, null, null, null, null, null, null, null];
    if (edges & 1) points[0] = this.vertexLerp(x, this.corners[0], this.corners[1]);
    if (edges & 2) points[1] = this.vertexLerp(x, this.corners[1], this.corners[2]);
    if (edges & 4) points[2] = this.vertexLerp(x, this.corners[2], this.corners[3]);
    if (edges & 8) points[3] = this.vertexLerp(x, this.corners[3], this.corners[0]);
    if (edges & 16) points[4] = this.vertexLerp(x, this.corners[4], this.corners[5]);
    if (edges & 32) points[5] = this.vertexLerp(x, this.corners[5], this.corners[6]);
    if (edges & 64) points[6] = this.vertexLerp(x, this.corners[6], this.corners[7]);
    if (edges & 128) points[7] = this.vertexLerp(x, this.corners[7], this.corners[4]);
    if (edges & 256) points[8] = this.vertexLerp(x, this.corners[4], this.corners[0]);
    if (edges & 512) points[9] = this.vertexLerp(x, this.corners[5], this.corners[1]);
    if (edges & 1024) points[10] = this.vertexLerp(x, this.corners[6], this.corners[2]);
    if (edges & 2048) points[11] = this.vertexLerp(x, this.corners[7], this.corners[3]);
    return points;
  }

  getNormal(point) {
    var x0 = new THREE.Vector3(point.x - episolon, point.y, point.z);
    var x1 = new THREE.Vector3(point.x + episolon, point.y, point.z);
    var x = sample(x1) - sample(x0);
    var y0 = new THREE.Vector3(point.x, point.y - episolon, point.z);
    var y1 = new THREE.Vector3(point.x, point.y + episolon, point.z);
    var y = sample(y1) - sample(y0);
    var z0 = new THREE.Vector3(point.x, point.y, point.z - episolon);
    var z1 = new THREE.Vector3(point.x, point.y, point.z + episolon);
    var z = sample(z1) - sample(z0);
    var n = new THREE.Vector3(x,y,z);
    return n.normalize();
  }

  polygonize(isolevel) {

    var vertexList = [];
    var normalList = [];
    var faceList = [];

    // get corner vertices that are inside metaballs
    var corner = 1;
    var allVert = 0;
    for (var i = 0; i < 8; i ++) {
      if (this.corners[i].isovalue > isolevel) {
        allVert |= corner;
      }
      corner = corner << 1;
    }

    if (allVert != 0) {
      // get intersected edges
      var edges = LUT.EDGE_TABLE[allVert];

      // get 12 points
      var points = this.edgePoints(edges, isolevel);

      for (var j = 0; j < 16; j ++) {
        var tri = LUT.TRI_TABLE[allVert*16 + j];
        if (tri < 0) break;
        var vertex = points[tri];
        vertexList.push(vertex);
        normalList.push(this.getNormal(vertex));
      }
    }


    return {
      vertPositions: vertexList,
      vertNormals: normalList
    };
  };
}
