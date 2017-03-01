const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;
const E = 1e-5;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );

const STD_UNIFORMS = (obj) => {
  return Object.assign({
    u_albedo: {
      type: 'vec3',
      value: new THREE.Color(0xFF0000)
    },
    u_ambient: {
      type: 'v3',
      value: new THREE.Color(0xFFFFFF)
    },
    u_lightCol: {
      type: 'v3',
      value: new THREE.Color(0xFFFFFF)
    },
    u_lightPos: {
      type: 'v3',
      value: new THREE.Vector3(5, 10, 10)
    },
    u_lightIntensity: {
      type: 'f',
      value: 0.1
    },
    u_viewPos: {
      type: 'v3',
      value: window.viewPos
    }
  }, obj);
};

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
    var isovalue = 0.0;
    for (var i = 0; i < this.balls.length; i++) {
      isovalue += this.balls[i].radius2 / point.distanceToSquared(this.balls[i].pos);
    }
    return isovalue;
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
      
      for (var i = 0; i < 8; i++) {
        this.voxels[c].corners[i].isovalue = this.sample(this.voxels[c].corners[i].pos);
      }

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {
        
        // Toggle voxels on or off
        if (this.voxels[c].center.isovalue > this.isolevel) {
          this.voxels[c].show();
        } 
        else {
          this.voxels[c].hide();
        }

        for (var i = 0; i < 8; i++) {
          this.voxels[c].corners[i].updateLabel(this.camera);
        }
      } 

      else {

        for (var i = 0; i < 8; i++) {
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

  makeMesh() {
    this.mesh = new THREE.Mesh(new THREE.Geometry(), LAMBERT_GREEN);
    this.mesh.geometry.dynamic = true;
    this.scene.add(this.mesh);
  }

  updateMesh() {
    var newVertices = [];
    var newFaces = [];

    var faceIdx = 0;

    for (var i = 0; i < this.voxels.length; i++) {
      var poly = this.voxels[i].polygonize(this.isolevel, this.sample.bind(this));
      
      for (var j = 0; j < poly.vertexPositions.length; j+=3) {
        var vp = poly.vertexPositions;
        newVertices.push(vp[j], vp[j + 1], vp[j + 2]);
        var vn = poly.vertexNormals;
        var normals = [vn[j], vn[j + 1], vn[j + 2]];
        newFaces.push(new THREE.Face3(3 * faceIdx, 3 * faceIdx + 1, 3 * faceIdx + 2));
        faceIdx++;
      }
      
    }
    
    this.mesh.geometry.vertices = newVertices;
    this.mesh.geometry.faces = newFaces;

    this.mesh.geometry.verticesNeedUpdate = true;
    this.mesh.geometry.elementsNeedUpdate = true;

    this.mesh.geometry.computeFaceNormals();
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

    this.corners = [];

    this.corners[0] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[1] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[2] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[3] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[4] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[5] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[6] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[7] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
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
    var t = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
    return new THREE.Vector3(
              posA.pos.x + t * (posB.pos.x - posA.pos.x), 
              posA.pos.y + t * (posB.pos.y - posA.pos.y), 
              posA.pos.z + t * (posB.pos.z - posA.pos.z));
  }

  polygonize(isolevel, sample) {

    var vertexPositions = [];
    var vertexNormals = [];

    var idx = 0;

    for (var i = 0; i < 8; i++) {
      if (this.corners[i].isovalue < isolevel) {
        idx |= Math.pow(2, i);
      }
    }

    if (LUT.EDGE_TABLE[idx] == 0) {
      return {
        vertexPositions,
        vertexNormals
      };
    }
    
    var vertexlist = [];
    for (var i = 0; i < 12; i++) {
      var c = i % 8;
      var n = c + 1;
      if (i < 8 && (i + 1) % 4 == 0)
      {
        n = c - 3;
      }
      if (i >= 8)
      {
        n = c + 4;
      }
      if (LUT.EDGE_TABLE[idx] & Math.pow(2, i)) {
        vertexlist[i] = this.vertexInterpolation(isolevel, this.corners[c], this.corners[n]);
      }
    }

    for (var i = 0; i < 16; i++) {
      var tri = LUT.TRI_TABLE[16 * idx + i];

      if (tri < 0) {
        break;
      }

      var pt = vertexlist[tri];
      var s = sample(pt);
      var delta = new THREE.Vector3(sample(new THREE.Vector3(E, 0, 0).add(pt)), 
                                    sample(new THREE.Vector3(0, E, 0).add(pt)), 
                                    sample(new THREE.Vector3(0, 0, E).add(pt)));
      var normal = delta.subScalar(s).normalize();

      vertexPositions.push(pt);
      vertexNormals.push(normal);
    }

    return {
      vertexPositions: vertexPositions,
      vertexNormals: vertexNormals
    };

  };
}