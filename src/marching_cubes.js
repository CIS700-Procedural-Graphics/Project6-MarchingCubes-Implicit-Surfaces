const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );

// options
var options = {
    lightColor: '#ffffff',
    lightIntensity: 2,
    albedo: '#dddddd',
    ambient: '#111111',
}

export const Shaders = {
    'lambert': new THREE.ShaderMaterial({
      uniforms: {
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
        },
        u_cameraPos: {
          type: 'v3',
          value: window.position
        }
      },
      vertexShader: require('./glsl/toon-vert.glsl'),
      fragmentShader: require('./glsl/toon-frag.glsl')
    }),
    'toon': new THREE.ShaderMaterial({
      uniforms: {
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
        },
        u_cameraPos: {
          type: 'v3',
          value: window.position
        }
      },
      vertexShader: require('./glsl/toon-vert.glsl'),
      fragmentShader: require('./glsl/toon-frag.glsl')
    })
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

    this.showSpheres = false;
    this.showGrid = false;

    this.shader = App.config.shader;
    this.scene.remove(this.mesh);
    this.balls.forEach((ball) => {
      this.scene.remove(ball)
    });
    this.balls = [];

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
    var iso_sum = 0.0;
    this.balls.forEach(function(ball) {
      iso_sum += Math.pow(ball.radius, 2) / (Math.pow((point.x - ball.pos.x), 2) + Math.pow((point.y - ball.pos.y), 2) + Math.pow((point.z - ball.pos.z), 2))
    });
    return iso_sum;
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
      // Sample each corner
      this.voxels[c].zero.isovalue = this.sample(this.voxels[c].zero.pos);
      this.voxels[c].one.isovalue = this.sample(this.voxels[c].one.pos);
      this.voxels[c].two.isovalue = this.sample(this.voxels[c].two.pos);
      this.voxels[c].three.isovalue = this.sample(this.voxels[c].three.pos);

      this.voxels[c].four.isovalue = this.sample(this.voxels[c].four.pos);
      this.voxels[c].five.isovalue = this.sample(this.voxels[c].five.pos);
      this.voxels[c].six.isovalue = this.sample(this.voxels[c].six.pos);
      this.voxels[c].seven.isovalue = this.sample(this.voxels[c].seven.pos);

      // Visualizing grid
      this.voxels[c].hide();
      if (VISUAL_DEBUG && this.showGrid) {
        // Toggle voxels on or off
        if (this.voxels[c].zero.isovalue > this.isolevel) {
          this.voxels[c].show(); 
        }
        if (this.voxels[c].one.isovalue > this.isolevel) {
          this.voxels[c].show();
        } 
        if (this.voxels[c].two.isovalue > this.isolevel) {
          this.voxels[c].show();
        }
        if (this.voxels[c].three.isovalue > this.isolevel) {
          this.voxels[c].show();
        }
        if (this.voxels[c].four.isovalue > this.isolevel) {
          this.voxels[c].show();
        }
        if (this.voxels[c].five.isovalue > this.isolevel) {
          this.voxels[c].show();
        }
        if (this.voxels[c].six.isovalue > this.isolevel) {
          this.voxels[c].show();
        }
        if (this.voxels[c].seven.isovalue > this.isolevel) {
          this.voxels[c].show();
        }
        // this.voxels[c].center.updateLabel(this.camera);
        this.voxels[c].zero.updateLabel(this.camera);
        this.voxels[c].one.updateLabel(this.camera);
        this.voxels[c].two.updateLabel(this.camera);
        this.voxels[c].three.updateLabel(this.camera);
        this.voxels[c].four.updateLabel(this.camera);
        this.voxels[c].five.updateLabel(this.camera);
        this.voxels[c].six.updateLabel(this.camera);
        this.voxels[c].seven.updateLabel(this.camera);
      } 
      else {
        this.voxels[c].zero.clearLabel(this.camera);
        this.voxels[c].one.clearLabel(this.camera);
        this.voxels[c].two.clearLabel(this.camera);
        this.voxels[c].three.clearLabel(this.camera);
        this.voxels[c].four.clearLabel(this.camera);
        this.voxels[c].five.clearLabel(this.camera);
        this.voxels[c].six.clearLabel(this.camera);
        this.voxels[c].seven.clearLabel(this.camera);
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
    console.log(this.shader);
    // this.mesh = new THREE.Mesh(new THREE.Geometry(), Shaders[this.shader]);
    this.mesh = new THREE.Mesh(new THREE.Geometry(), new THREE.MeshLambertMaterial({color: '#c0c0c0'}));
    this.mesh.geometry.dynamic = true;
    this.scene.add(this.mesh);
  }

  updateMesh() {
    // @TODO
    var vertices = [];
    var faces = [];
    this.voxels.forEach(vox => {
      var vert_data = vox.polygonize(this.isolevel, this.sample.bind(this));
      var tri_verts_pos = vert_data.vertexList;
      var tri_verts_norm = vert_data.normalList;
      for (var i = 0; i < tri_verts_pos.length / 3; i++) {
        vertices.push(tri_verts_pos[3 * i], tri_verts_pos[3 * i + 1], tri_verts_pos[3 * i + 2]);
        var normals = [tri_verts_norm[3 * i], tri_verts_norm[3 * i + 1], tri_verts_norm[3 * i + 2]];
        var face_idx = faces.length;
        faces.push(new THREE.Face3(face_idx * 3, face_idx * 3 + 1, face_idx * 3 + 2, normals));
      }
    });
    this.mesh.geometry.vertices = vertices;
    this.mesh.geometry.faces = faces;
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
    var offset = this.gridCellWidth / 2.0;
    var x = this.pos.x;
    var y = this.pos.y;
    var z = this.pos.z;
    var red = 0xff0000;

    // Center dot
    // this.center = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
    this.zero = new InspectPoint(new THREE.Vector3(x - offset, y - offset, z - offset), 0, VISUAL_DEBUG);
    this.one = new InspectPoint(new THREE.Vector3(x + offset, y - offset, z - offset), 0, VISUAL_DEBUG);
    this.two = new InspectPoint(new THREE.Vector3(x + offset, y - offset, z + offset), 0, VISUAL_DEBUG);
    this.three = new InspectPoint(new THREE.Vector3(x - offset, y - offset, z + offset), 0, VISUAL_DEBUG);
    this.four = new InspectPoint(new THREE.Vector3(x - offset, y + offset, z - offset), 0, VISUAL_DEBUG);
    this.five = new InspectPoint(new THREE.Vector3(x + offset, y + offset, z - offset), 0, VISUAL_DEBUG);
    this.six = new InspectPoint(new THREE.Vector3(x + offset, y + offset, z + offset), 0, VISUAL_DEBUG);
    this.seven = new InspectPoint(new THREE.Vector3(x - offset, y + offset, z + offset), 0, VISUAL_DEBUG);
  }

  show() {
    if (this.mesh) {
      //this.mesh.visible = true;
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

  vertexInterpolation(isolevel, vertA, vertB) {
    // @TODO
    var t = (isolevel - vertA.isovalue) / (vertB.isovalue - vertA.isovalue);
    return new THREE.Vector3().lerpVectors(vertA.pos, vertB.pos, t);
  }

  edge_to_verts(edge) {
    if (edge === 0) { return { A: this.zero, B: this.one} }
    if (edge === 1) { return { A: this.one, B: this.two} }
    if (edge === 2) { return { A: this.two, B: this.three} }
    if (edge === 3) { return { A: this.three, B: this.zero} }
    if (edge === 4) { return { A: this.four, B: this.five} }
    if (edge === 5) { return { A: this.five, B: this.six} }
    if (edge === 6) { return { A: this.six, B: this.seven} }
    if (edge === 7) { return { A: this.seven, B: this.four} }
    if (edge === 8) { return { A: this.zero, B: this.four} }
    if (edge === 9) { return { A: this.one, B: this.five} }
    if (edge === 10) { return { A: this.two, B: this.six} }
    if (edge === 11) { return { A: this.three, B: this.seven} }
  }

  polygonize(isolevel, sample) {
    // @TODO
    var vertexList = [];
    var normalList = [];
    var edge_vert_map = {};

    var cubeindex = 0;
    if (this.zero.isovalue > isolevel) { cubeindex |= 1; }
    if (this.one.isovalue > isolevel) { cubeindex |= 2; }
    if (this.two.isovalue > isolevel) { cubeindex |= 4; }
    if (this.three.isovalue > isolevel) { cubeindex |= 8; }
    if (this.four.isovalue > isolevel) { cubeindex |= 16; }
    if (this.five.isovalue > isolevel) { cubeindex |= 32; }
    if (this.six.isovalue > isolevel) { cubeindex |= 64; }
    if (this.seven.isovalue > isolevel) { cubeindex |= 128; }
    var edges = LUT.EDGE_TABLE[cubeindex];

    if (edges === 0) {
      return { vertexList, normalList };
    }
    else {
      var tri_table = LUT.TRI_TABLE;
      for (var i = 0; i < 12; i++) {
        if (edges & 1) {
          // this means edge i will be cut
          var edge_verts = this.edge_to_verts(i);
          edge_vert_map[i] = this.vertexInterpolation(isolevel, edge_verts.A, edge_verts.B);
        }
        edges >>= 1;
      }
      for (var i = 0; i < 16; i++) {
        var edge = tri_table[16 * cubeindex + i];
        if (edge === -1) {
          break;
        }
        var p = edge_vert_map[edge];
        var point_iso = sample(p);
        var delX = new THREE.Vector3(-0.001, 0, 0);
        var delY = new THREE.Vector3(0, -0.001, 0);
        var delZ = new THREE.Vector3(0, 0, -0.001);
        var del = new THREE.Vector3(sample(delX.add(p)), sample(delY.add(p)), sample(delZ.add(p)));
        var norm = del.subScalar(point_iso).normalize();
        vertexList.push(p);
        normalList.push(norm);
      }
      return { vertexList, normalList };
    }
  }
}