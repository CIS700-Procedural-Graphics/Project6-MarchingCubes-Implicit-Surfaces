const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;
var deltaPos = [new THREE.Vector3(0,0,0),
                new THREE.Vector3(1,0,0),
                new THREE.Vector3(-1,0,0),
                new THREE.Vector3(0,1,0),
                new THREE.Vector3(0,-1,0),
                new THREE.Vector3(0,0,1),
                new THREE.Vector3(0,0,-1)];

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );

var BALL_MAT = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
        u_color: {
            type: 'v3',
            value: new THREE.Color('#ffffff')
        },
        u_ambient: {
            type: 'v3',
            value: new THREE.Color('#111111')
        },
        u_lightPos: {
            type: 'v3',
            value: new THREE.Vector3(40,40,40)
        },
        u_lightCol: {
            type: 'v3',
            value: new THREE.Color('#ffffff')
        },
        u_lightIntensity: {
            type: 'f',
            value: 1
        }
    },
    vertexShader: require('./shaders/vert.glsl'),
    fragmentShader: require('./shaders/frag.glsl')
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

  updateColor(color) {
    BALL_MAT.uniforms.u_lightCol.value = new THREE.Color(color);
  }

  updateAmbient(color) {
    BALL_MAT.uniforms.u_ambient.value = new THREE.Color(color);
  }

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

    var isovalues = [1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1];

    var gradient = new THREE.Vector3(0,0,0);
    this.balls.forEach(function(ball) {
      for (var i = 0; i < 7; i++) {
        var dist = point.distanceTo(new THREE.Vector3(ball.pos.x + deltaPos[i].x, ball.pos.y + deltaPos[i].y,ball.pos.z + deltaPos[i].z));
        var influence = (ball.radius * ball.radius) / (dist * dist);
        isovalues[i] += influence;
      }
    });

    gradient.x = (isovalues[1] - isovalues[2]) / this.gridWidth;
    gradient.y = (isovalues[3] - isovalues[4]) / this.gridWidth;
    gradient.z = (isovalues[5] - isovalues[6]) / this.gridWidth;

    return {
      isovalue: isovalues[0],
      normal: gradient
    };
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
      var sampleResult = this.sample(this.voxels[c].center.pos);
      this.voxels[c].center.isovalue = sampleResult.isovalue;

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

      // Sample corners
      for (var i = 0; i < 8; i++) {
        sampleResult = this.sample(this.voxels[c].corners[i].pos); 
        this.voxels[c].corners[i].isovalue = sampleResult.isovalue;
        this.voxels[c].corners[i].normal = sampleResult.normal;

        if (VISUAL_DEBUG && this.showGrid) {
          this.voxels[c].corners[i].updateLabel(this.camera);
        } else {
          this.voxels[c].corners[i].clearLabel();
        }
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

  removeMesh() {
    if (this.scene.children) {
      console.log("here");
      console.log(this.scene.children);
      this.scene.children.forEach(function(object) {
          if (object.type === "Mesh") {
            this.scene.remove(object);
          }
      });
    }
  }

  makeMesh() {
    var hasMesh = false;
    if (this.scene.children) {
      this.scene.children.forEach(function(object) {
        if (object.type === "Mesh") {
          hasMesh = true;
        }
      });
    }

    if (!hasMesh) {
      var geometry = new THREE.Geometry();
      var material = new THREE.MeshLambertMaterial({color: 0xff00ff, side: THREE.DoubleSide});
      this.mesh = new THREE.Mesh(geometry, BALL_MAT);
      this.scene.add(this.mesh);
    }
  }

  updateMesh() {

    var geometry = new THREE.Geometry();
    var count = 0;

    this.voxels.forEach(function(voxel) {
      var poly = voxel.polygonize(this.isolevel);
      for (var j = 0; j < 16; j+=3) {
        if (LUT.TRI_TABLE[poly.cubeIndex * 16 + j] == -1) {
          break;
        }

        var idx1 = poly.cubeIndex * 16 + j;
        var idx2 = poly.cubeIndex * 16 + j + 1;
        var idx3 = poly.cubeIndex * 16 + j + 2;

        geometry.vertices.push(poly.vertPositions[LUT.TRI_TABLE[idx1]]);
        geometry.vertices.push(poly.vertPositions[LUT.TRI_TABLE[idx2]]);
        geometry.vertices.push(poly.vertPositions[LUT.TRI_TABLE[idx3]]);

        var n1 = poly.vertNormals[LUT.TRI_TABLE[idx1]];
        var n2 = poly.vertNormals[LUT.TRI_TABLE[idx2]];
        var n3 = poly.vertNormals[LUT.TRI_TABLE[idx3]];

        var normal = n1.lerp(n2.lerp(n3, 0.5), 0.5).normalize();
        normal = new THREE.Vector3(normal.x, -normal.y, normal.z);
        geometry.faces.push(new THREE.Face3(count + 0, count + 1, count + 2, normal));
        count += 3;

      }
    }, this);

    this.mesh.geometry = geometry;
    this.mesh.needsUpdate = true;
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

    // Corners
    this.corners = [];
    var pointIdx = [7, 3, 2, 6, 5, 1, 0 ,4];
    for (var i = 0; i < 8; i++) {
      var x = this.pos.x + Math.pow(-1, (pointIdx[i]>>0)&1) * halfGridCellWidth;
      var y = this.pos.y + Math.pow(-1, (pointIdx[i]>>1)&1) * halfGridCellWidth;
      var z = this.pos.z + Math.pow(-1, (pointIdx[i]>>2)&1) * halfGridCellWidth;

      this.corners[i] = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
      // console.log(this.corners[i]);
    }

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

  vertexInterpolation(isolevel, posA, posB) {

    if (Math.abs(isolevel-posA.isovalue) < 0.00001) {
      return {pos : posA.pos, normal : posA.normal};
    }
    if (Math.abs(isolevel-posB.isovalue) < 0.00001) {
      return {pos : posB.pos, normal : posB.normal};
    }
    if (Math.abs(posA.isovalue-posB.isovalue) < 0.00001) {
      return {pos : posA.pos, normal : posA.normal};
    }

    var mu = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
    var lerpPos = new THREE.Vector3(0,0,0);
    lerpPos.lerpVectors(posA.pos, posB.pos, mu);

    var lerpNormal = new THREE.Vector3(0,0,0);
    lerpNormal.lerpVectors(posA.normal, posB.normal, mu);

    return {pos : lerpPos, normal : lerpNormal};
  }

  polygonize(isolevel) {

    // @TODO
    var vertexList = [];
    var normalList = [];

    // For more info, see : http://paulbourke.net/geometry/polygonise/ 
    var cubeindex = 0;
    if (this.corners[0].isovalue < isolevel) cubeindex |= 1;
    if (this.corners[1].isovalue < isolevel) cubeindex |= 2;
    if (this.corners[2].isovalue < isolevel) cubeindex |= 4;
    if (this.corners[3].isovalue < isolevel) cubeindex |= 8;
    if (this.corners[4].isovalue < isolevel) cubeindex |= 16;
    if (this.corners[5].isovalue < isolevel) cubeindex |= 32;
    if (this.corners[6].isovalue < isolevel) cubeindex |= 64;
    if (this.corners[7].isovalue < isolevel) cubeindex |= 128;

    if (LUT.EDGE_TABLE[cubeindex] == 0) {
      return {
        cubeIndex: cubeindex,
        vertPositions: vertexList,
        vertNormals: normalList
      };
    }

    var result;
    if (LUT.EDGE_TABLE[cubeindex] & 1) {
       result = this.vertexInterpolation(isolevel, this.corners[0], this.corners[1]);
       vertexList[0] = result.pos;
       normalList[0] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 2) {
       result = this.vertexInterpolation(isolevel, this.corners[1], this.corners[2]);
       vertexList[1] = result.pos;
       normalList[1] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 4) {
       result = this.vertexInterpolation(isolevel, this.corners[2], this.corners[3]);
       vertexList[2] = result.pos;
       normalList[2] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 8) {
       result = this.vertexInterpolation(isolevel, this.corners[3], this.corners[0]);
       vertexList[3] = result.pos;
       normalList[3] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 16) {
       result = this.vertexInterpolation(isolevel, this.corners[4], this.corners[5]);
       vertexList[4] = result.pos;
       normalList[4] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 32) {
       result = this.vertexInterpolation(isolevel, this.corners[5], this.corners[6]);
       vertexList[5] = result.pos;
       normalList[5] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 64) {
       result = this.vertexInterpolation(isolevel, this.corners[6], this.corners[7]);
       vertexList[6] = result.pos;
       normalList[6] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 128) {
       result = this.vertexInterpolation(isolevel, this.corners[7], this.corners[4]);
       vertexList[7] = result.pos;
       normalList[7] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 256) {
       result = this.vertexInterpolation(isolevel, this.corners[0], this.corners[4]);
       vertexList[8] = result.pos;
       normalList[8] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 512) {
       result = this.vertexInterpolation(isolevel, this.corners[1], this.corners[5]);
       vertexList[9] = result.pos;
       normalList[9] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 1024) {
       result = this.vertexInterpolation(isolevel, this.corners[2], this.corners[6]);
       vertexList[10] = result.pos;
       normalList[10] = result.normal;
    }
    if (LUT.EDGE_TABLE[cubeindex] & 2048) {
       result = this.vertexInterpolation(isolevel, this.corners[3], this.corners[7]);
       vertexList[11] = result.pos;
       normalList[11] = result.normal;
    }

    return {
      cubeIndex: cubeindex,
      vertPositions: vertexList,
      vertNormals: normalList
    };
  };
}