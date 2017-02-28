const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;

var options = {
    lightColor: '#ffffff',
    lightIntensity: 2,
    albedo: '#ffffff',
    ambient: '#111111',
    useTexture: false
}

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x55ee55, transparent: true, opacity: 0.2 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );
const CUSTOM_LAMBERT = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
        texture: {
            type: "t",
            value: null
        },
        u_useTexture: {
            type: 'i',
            value: options.useTexture
        },
        u_albedo: {
            type: 'v3',
            value: new THREE.Color(options.albedo)
        },
        u_ambient: {
            type: 'v3',
            value: new THREE.Color(options.ambient)
        },
        u_lightPos: {
            type: 'v3',
            value: new THREE.Vector3(30, 50, 40)
        },
        u_lightCol: {
            type: 'v3',
            value: new THREE.Color(options.lightColor)
        },
        u_lightIntensity: {
            type: 'f',
            value: options.lightIntensity
        }
    },
    vertexShader: require('./shaders/lambert-vert.glsl'),
    fragmentShader: require('./shaders/lambert-frag.glsl')
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
    var isovalue = 1.1;
    var normal = new THREE.Vector3(0,0,0);
    this.balls.forEach(function(ball) {
      var d = point.distanceTo(ball.pos);
      var i = (ball.radius * ball.radius) / (d * d);
      isovalue += i;

      var n = new THREE.Vector3((point.x - ball.pos.x), (point.y - ball.pos.y), (point.z - ball.pos.z));
      normal.add(n.multiplyScalar(2 * i * i));
    });
    return {
      isovalue: isovalue,
      normal: normal
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
      var sample = this.sample(this.voxels[c].center.pos);
      this.voxels[c].center.isovalue = sample.isovalue;

      for (var i = 0; i < this.voxels[c].grid.length; i++) {
        sample = this.sample(this.voxels[c].grid[i].pos);
        this.voxels[c].grid[i].isovalue = sample.isovalue;
        this.voxels[c].grid[i].normal = sample.normal;
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
        this.voxels[c].grid.forEach((function(vert) {
          vert.updateLabel(this.camera);
        }).bind(this));
      } else {
        this.voxels[c].center.clearLabel();
        this.voxels[c].grid.forEach(function(vert) {
          vert.clearLabel();
        });
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
    var geometry = new THREE.Geometry();
    var material = new THREE.MeshLambertMaterial( {color: 0xff0000, side: THREE.DoubleSide} );
    this.mesh = new THREE.Mesh( geometry, material );
    this.mesh.name = "surface";
    this.scene.add(this.mesh);
  }

  updateMesh() {
    var geometry = new THREE.Geometry();
    for (var i = 0; i < this.voxels.length; i++) {
      // for each voxel, compute vertices that are within the metaballs and
      // draw the triangle planes within each voxel, then combine all the triangle
      // geometries into a single mesh
      var voxel = this.voxels[i];
      var p = voxel.polygonize(this.isolevel);
      var cubeindex = p.cubeIndex;

      for (var j = 0; j < 16; j+=3) {
        if (LUT.TRI_TABLE[cubeindex * 16 + j] == -1) {
          break;
        }

        var triangleGeo = new THREE.Geometry();
        var v1 = p.vertPositions[LUT.TRI_TABLE[cubeindex * 16 + j]];
        var v2 = p.vertPositions[LUT.TRI_TABLE[cubeindex * 16 + j + 1]];
        var v3 = p.vertPositions[LUT.TRI_TABLE[cubeindex * 16 + j + 2]];
        triangleGeo.vertices.push(v1);
        triangleGeo.vertices.push(v2);
        triangleGeo.vertices.push(v3);

        var n1 = p.vertNormals[LUT.TRI_TABLE[cubeindex * 16 + j]];
        var n2 = p.vertNormals[LUT.TRI_TABLE[cubeindex * 16 + j + 1]];
        var n3 = p.vertNormals[LUT.TRI_TABLE[cubeindex * 16 + j + 2]];
        var normal = n1.lerp(n2.lerp(n3, 0.5), 0.5).normalize();
        normal = new THREE.Vector3(normal.x, -normal.y, normal.z);
        triangleGeo.faces.push(new THREE.Face3(0, 1, 2, normal));
        // triangleGeo.computeVertexNormals();
        // triangleGeo.computeFaceNormals();

        var triangleMesh = new THREE.Mesh(triangleGeo);
        triangleMesh.updateMatrix();
        geometry.merge(triangleMesh.geometry, triangleMesh.matrix);
      }
    }
    var surface = this.scene.getObjectByName("surface");
    surface.geometry = geometry;
    surface.needsUpdate = true;
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

    var positions = new Float32Array([
      // Top face
      -halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth, -halfGridCellWidth,  halfGridCellWidth,
      -halfGridCellWidth, -halfGridCellWidth,  halfGridCellWidth,

      // Bottom face
      -halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth,
       halfGridCellWidth,  halfGridCellWidth,  halfGridCellWidth,
      -halfGridCellWidth,  halfGridCellWidth,  halfGridCellWidth,
    ]);
    this.grid = [];
    for (var i = 0; i < 8; i++) {
      var x = this.pos.x + positions[i * 3];
      var y = this.pos.y + positions[i * 3 + 1];
      var z = this.pos.z + positions[i * 3 + 2];
      this.grid[i] = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
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

  // Interpolate the point where the plane intersects the voxel edge
  // http://paulbourke.net/geometry/polygonise/
  vertexInterpolation(isolevel, A, B) {
    if (Math.abs(isolevel-A.isovalue) < 0.00001)
      return {pos: A.pos, normal: A.normal};
    if (Math.abs(isolevel-B.isovalue) < 0.00001)
      return {pos: B.pos, normal: B.normal};
    if (Math.abs(A.isovalue-B.isovalue) < 0.00001)
      return {pos: A.pos, normal: A.normal};
    var mu = (isolevel - A.isovalue) / (B.isovalue - A.isovalue);
    var lerpPos = new THREE.Vector3(0,0,0);
    lerpPos.x = A.pos.x + mu * (B.pos.x - A.pos.x);
    lerpPos.y = A.pos.y + mu * (B.pos.y - A.pos.y);
    lerpPos.z = A.pos.z + mu * (B.pos.z - A.pos.z);

    var lerpNormal = new THREE.Vector3(0,0,0);
    lerpNormal.x = A.normal.x + mu * (B.normal.x - A.normal.x);
    lerpNormal.y = A.normal.y + mu * (B.normal.y - A.normal.y);
    lerpNormal.z = A.normal.z + mu * (B.normal.z - A.normal.z);

    return {pos: lerpPos, normal: lerpNormal};
  }

  // per voxel, determine the set of triangles to draw within the voxel
  polygonize(isolevel) {

    var vertPositions = [];
    var vertNormals = [];

    var cubeindex = 0;
    if (this.grid[0].isovalue < isolevel) cubeindex |= 1;
    if (this.grid[1].isovalue < isolevel) cubeindex |= 2;
    if (this.grid[2].isovalue < isolevel) cubeindex |= 4;
    if (this.grid[3].isovalue < isolevel) cubeindex |= 8;
    if (this.grid[4].isovalue < isolevel) cubeindex |= 16;
    if (this.grid[5].isovalue < isolevel) cubeindex |= 32;
    if (this.grid[6].isovalue < isolevel) cubeindex |= 64;
    if (this.grid[7].isovalue < isolevel) cubeindex |= 128;

    if (LUT.EDGE_TABLE[cubeindex] == 0) {
      return {
        cubeIndex: cubeindex,
        vertPositions: vertPositions,
        vertNormals: vertNormals
      };
    }

    var lerp;
    if (LUT.EDGE_TABLE[cubeindex] & 1) { // is truthy
       lerp = this.vertexInterpolation(isolevel, this.grid[0], this.grid[1]);
       vertPositions[0] = lerp.pos;
       vertNormals[0] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 2) {
      lerp = this.vertexInterpolation(isolevel, this.grid[1], this.grid[2]);
      vertPositions[1] = lerp.pos;
      vertNormals[1] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 4) {
      lerp = this.vertexInterpolation(isolevel, this.grid[2], this.grid[3]);
      vertPositions[2] = lerp.pos;
      vertNormals[2] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 8) {
      lerp = this.vertexInterpolation(isolevel, this.grid[3], this.grid[0]);
      vertPositions[3] = lerp.pos;
      vertNormals[3] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 16) {
      lerp = this.vertexInterpolation(isolevel, this.grid[4], this.grid[5]);
      vertPositions[4] = lerp.pos;
      vertNormals[4] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 32) {
      lerp = this.vertexInterpolation(isolevel, this.grid[5], this.grid[6]);
      vertPositions[5] = lerp.pos;
      vertNormals[5] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 64) {
      lerp = this.vertexInterpolation(isolevel, this.grid[6], this.grid[7]);
      vertPositions[6] = lerp.pos;
      vertNormals[6] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 128) {
      lerp = this.vertexInterpolation(isolevel, this.grid[7], this.grid[4]);
      vertPositions[7] = lerp.pos;
      vertNormals[7] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 256) {
      lerp = this.vertexInterpolation(isolevel, this.grid[0], this.grid[4]);
      vertPositions[8] = lerp.pos;
      vertNormals[8] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 512) {
      lerp = this.vertexInterpolation(isolevel, this.grid[1], this.grid[5]);
      vertPositions[9] = lerp.pos;
      vertNormals[9] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 1024) {
      lerp = this.vertexInterpolation(isolevel, this.grid[2], this.grid[6]);
      vertPositions[10] = lerp.pos;
      vertNormals[10] = lerp.normal;
    }

    if (LUT.EDGE_TABLE[cubeindex] & 2048) {
      lerp = this.vertexInterpolation(isolevel, this.grid[3], this.grid[7]);
      vertPositions[11] = lerp.pos;
      vertNormals[11] = lerp.normal;
    }

    return {
      cubeIndex: cubeindex,
      vertPositions: vertPositions,
      vertNormals: vertNormals
    };
  };
}
