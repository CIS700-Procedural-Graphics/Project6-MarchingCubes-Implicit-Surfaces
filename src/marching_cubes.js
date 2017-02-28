const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = false;

const uniforms = {
  u_a: {
      type: 'v3',
      value: new THREE.Color('#2abeff')
  },
  u_b: {
      type: 'v3',
      value: new THREE.Color('#26e0e8')
  },
  u_c: {
      type: 'v3',
      value: new THREE.Color('#37ffcf')
  },
  u_d: {
      type: 'v3',
      value: new THREE.Color('#26e883')
  },
  u_lightPos: {
      type: 'v3',
      value: new THREE.Vector3(1, 10, 2)
  },
  u_lightCol: {
      type: 'v3',
      value: new THREE.Color('#ffffff')
  },
  u_cameraPos: {
    type: 'v3',
    value: new THREE.Vector3(5, 5, 30)
  }
};

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );
const SHADER_MAT = new THREE.ShaderMaterial({
  uniforms: uniforms,
  vertexShader: require('./shaders/mesh-vert.glsl'),
  fragmentShader: require('./shaders/mesh-frag.glsl')
});

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

      // TODO
      // Uncomment for voxel debugging
      // if (VISUAL_DEBUG) {
      //   this.scene.add(voxel.wireframe);
      //   this.scene.add(voxel.mesh);
      // }
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

      // TODO
      // Uncomment if you want metaballs
      // if (VISUAL_DEBUG) {
      //   this.scene.add(ball.mesh);
      // }
    }
  }

  // This function samples a point from the metaball's density function
  // Implement a function that returns the value of the all metaballs influence to a given point.
  // Please follow the resources given in the write-up for details.
  sample(point) {
    var val = 0.0;

    this.balls.forEach(function(ball) {
      var x = Math.pow(point.x - ball.pos.x, 2);
      var y = Math.pow(point.y - ball.pos.y, 2);
      var z = Math.pow(point.z - ball.pos.z, 2);

      val += Math.pow(ball.radius, 2) / (x + y + z);
    });

    return val;
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
      var voxelPts = ['000','001', '010', '100', '110', '101', '011', '111', 'center'];

      voxelPts.forEach(function(pt) {
        this.voxels[c][pt].isovalue = this.sample(this.voxels[c][pt].pos);

        // Visualizing grid
        if (VISUAL_DEBUG && this.showGrid) {

          // Toggle voxels on or off
          if (this.voxels[c][pt].isovalue > this.isolevel) {
            this.voxels[c].show();
          } else {
            this.voxels[c].hide();
          }
          this.voxels[c][pt].updateLabel(this.camera);
        } else {
          this.voxels[c][pt].clearLabel();
        }
      }, this);
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
    var geo = new THREE.BufferGeometry();
    var positions = new Float32Array(15000);
    var normals = new Float32Array(15000);

    geo.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.addAttribute('normal', new THREE.BufferAttribute(normals, 3, true));
    geo.dynamic = true;

    this.mesh = new THREE.Mesh(geo, SHADER_MAT);
    this.scene.add(this.mesh);
  }

  updateMesh() {
    var positions = [];
    var normals = [];

    var i = 0;

    this.voxels.forEach(function(voxel) {
      var polyData = voxel.polygonize(this.isolevel);

      if (!polyData) return;

      polyData.vertPositions.forEach(function(pos) {
        positions.push(pos.x);
        positions.push(pos.y);
        positions.push(pos.z);
      });

      polyData.vertNormals.forEach(function(norm) {
        normals.push(norm.x);
        normals.push(norm.y);
        normals.push(norm.z);
      });
    }, this);

    positions = new Float32Array(positions);
    normals = new Float32Array(normals);

    var positionsArr = this.mesh.geometry.attributes.position.array;
    var normalsArr = this.mesh.geometry.attributes.normal.array;

    for (var i = 0; i < 15000; i++) {
      positionsArr[i] = positions[i];
      normalsArr[i] = normals[i];
    }

    this.mesh.geometry.computeFaceNormals();
    this.mesh.geometry.computeVertexNormals();

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.normal.needsUpdate = true;
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

    // shorter variable name
    var half = halfGridCellWidth;

    // Center and corner dots
    this.center = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
    this['000'] = new InspectPoint(new THREE.Vector3(x - half, y - half, z - half), 0, VISUAL_DEBUG);
    this['001'] = new InspectPoint(new THREE.Vector3(x - half, y - half, z + half), 0, VISUAL_DEBUG);
    this['010'] = new InspectPoint(new THREE.Vector3(x - half, y + half, z - half), 0, VISUAL_DEBUG);
    this['100'] = new InspectPoint(new THREE.Vector3(x + half, y - half, z - half), 0, VISUAL_DEBUG);
    this['110'] = new InspectPoint(new THREE.Vector3(x + half, y + half, z - half), 0, VISUAL_DEBUG);
    this['101'] = new InspectPoint(new THREE.Vector3(x + half, y - half, z + half), 0, VISUAL_DEBUG);
    this['011'] = new InspectPoint(new THREE.Vector3(x - half, y + half, z + half), 0, VISUAL_DEBUG);
    this['111'] = new InspectPoint(new THREE.Vector3(x + half, y + half, z + half), 0, VISUAL_DEBUG);
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

  // referred to the implementation at
  // http://paulbourke.net/geometry/polygonise/

  vertexInterpolation(isolevel, posA, posB) {

    var p = new THREE.Vector3();
    var pA = posA.pos;
    var pB = posB.pos;
    var vA = posA.isovalue;
    var vB = posB.isovalue;
    var m = (isolevel - vA) / (vB - vA);

    p.x = pA.x + m * (pB.x - pA.x);
    p.y = pA.y + m * (pB.y - pA.y);
    p.z = pA.z + m * (pB.z - pA.z);

    return p;
  }

  // referred to the implementation at
  // http://paulbourke.net/geometry/polygonise/

  polygonize(isolevel) {

    // Populate vertexList

    var vertexList = [];
    var normalList = [];
    var idx = 0;

    if (this['001'].isovalue < isolevel) idx |= 1;
    if (this['101'].isovalue < isolevel) idx |= 2;
    if (this['100'].isovalue < isolevel) idx |= 4;
    if (this['000'].isovalue < isolevel) idx |= 8;
    if (this['011'].isovalue < isolevel) idx |= 16;
    if (this['111'].isovalue < isolevel) idx |= 32;
    if (this['110'].isovalue < isolevel) idx |= 64;
    if (this['010'].isovalue < isolevel) idx |= 128;

    var edgeTableVal = LUT.EDGE_TABLE[idx];

    if (edgeTableVal == 0) return;

    if (edgeTableVal & 1)    vertexList[0] = this.vertexInterpolation(isolevel, this['001'], this['101']);
    if (edgeTableVal & 2)    vertexList[1] = this.vertexInterpolation(isolevel, this['101'], this['100']);
    if (edgeTableVal & 4)    vertexList[2] = this.vertexInterpolation(isolevel, this['100'], this['000']);
    if (edgeTableVal & 8)    vertexList[3] = this.vertexInterpolation(isolevel, this['000'], this['001']);
    if (edgeTableVal & 16)   vertexList[4] = this.vertexInterpolation(isolevel, this['011'], this['111']);
    if (edgeTableVal & 32)   vertexList[5] = this.vertexInterpolation(isolevel, this['111'], this['110']);
    if (edgeTableVal & 64)   vertexList[6] = this.vertexInterpolation(isolevel, this['110'], this['010']);
    if (edgeTableVal & 128)  vertexList[7] = this.vertexInterpolation(isolevel, this['010'], this['011']);
    if (edgeTableVal & 256)  vertexList[8] = this.vertexInterpolation(isolevel, this['001'], this['011']);
    if (edgeTableVal & 512)  vertexList[9] = this.vertexInterpolation(isolevel, this['101'], this['111']);
    if (edgeTableVal & 1024) vertexList[10] = this.vertexInterpolation(isolevel, this['100'], this['110']);
    if (edgeTableVal & 2048) vertexList[11] = this.vertexInterpolation(isolevel, this['000'], this['010']);

    // Populate vertPositions

    var i = 0;
    var j = idx * 16;
    var indices = [];

    while (LUT.TRI_TABLE[i + j] != -1) {
      indices.push(LUT.TRI_TABLE[i + j]);
      indices.push(LUT.TRI_TABLE[i + j + 1]);
      indices.push(LUT.TRI_TABLE[i + j + 2]);

      i += 3;
    }

    var vertPositions = [];
    var vertNormals = [];

    indices.forEach(function(ind) {
      vertPositions.push(vertexList[ind]);
    });

    // Populate vertNormals

    var epsilon = 0.01;

    // for (var k = 0; k < indices.length; k += 3) {
    //   var p0 = vertPositions[k];
    //   var p1 = vertPositions[k + 1];
    //   var p2 = vertPositions[k + 2];

    //   var n0 = new THREE.Vector3();
    //   var n1 = new THREE.Vector3();
    //   var n2 = new THREE.Vector3();

    //   var u = p0.clone();
    //   var v = p1.clone();
    //   var w = p2.clone();

    //   u.sub(p2);
    //   v.sub(p1);
    //   w.sub(p0);

    //   vertNormals.push(n);
    // }

    return {
      vertPositions: vertPositions,
      vertNormals: vertNormals
    };
  };
}