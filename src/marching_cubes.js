const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;
const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );

var options = {
    lightColor: '#ffffff',
    lightIntensity: 2,
    albedo: '#dddddd',
    ambient: '#111111',
    useTexture: true
}

var toonMaterial;
var iriMaterial;

const E = 1e-3;
const v3 = (x, y, z) => {return new THREE.Vector3(x, y, z);};

export default class MarchingCubes {

  constructor(App) {      
    this.init(App);
  }

  init(App) {
    this.App = App;
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


    //

    toonMaterial = new THREE.ShaderMaterial({
      uniforms: {
         texture: {
                    type: "t", 
                    value: THREE.ImageUtils.loadTexture('./src/iridescent.bmp')
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
                },
                u_camPos: {
                    type: 'v3',
                    value: this.camera.position
                }
      },
      vertexShader: require('./glsl/toon-vert.glsl'),
      fragmentShader: require('./glsl/toon-frag.glsl')
    });

    iriMaterial = new THREE.ShaderMaterial({
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
                },
                u_camPos: {
                    type: 'v3',
                    value: this.camera.position
                }
      },
      vertexShader: require('./glsl/iridescent-vert.glsl'),
      fragmentShader: require('./glsl/iridescent-frag.glsl')
    });

    //
    if (this.App.config.material == 'toon') {
      this.material = toonMaterial;
    } 
    else if (this.App.config.material == 'lambert') {
      this.material = LAMBERT_WHITE;
    }
    else if (this.App.config.material == 'iridescent') {
      this.material = iriMaterial;
    }
    else {
      this.material = this.App.config.material;
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
    var isovalue = 0.0;
    
    for (var i = 0; i < this.balls.length; i++) {
        var x = (point.x - this.balls[i].pos.x) * (point.x - this.balls[i].pos.x);
        var y = (point.y - this.balls[i].pos.y) * (point.y - this.balls[i].pos.y);
        var z = (point.z - this.balls[i].pos.z) * (point.z - this.balls[i].pos.z);
        isovalue += this.balls[i].radius2 / (x + y + z);
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

      // Sampling each of the corners
      this.voxels[c].val[0].isovalue = this.sample(this.voxels[c].val[0].pos);
      this.voxels[c].val[1].isovalue = this.sample(this.voxels[c].val[1].pos);
      this.voxels[c].val[2].isovalue = this.sample(this.voxels[c].val[2].pos);
      this.voxels[c].val[3].isovalue = this.sample(this.voxels[c].val[3].pos);
      this.voxels[c].val[4].isovalue = this.sample(this.voxels[c].val[4].pos);
      this.voxels[c].val[5].isovalue = this.sample(this.voxels[c].val[5].pos);
      this.voxels[c].val[6].isovalue = this.sample(this.voxels[c].val[6].pos);
      this.voxels[c].val[7].isovalue = this.sample(this.voxels[c].val[7].pos);

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
  updateMaterial() {
    if (this.App.config.material == 'toon') {
      this.material = toonMaterial;
    } 
    else if (this.App.config.material == 'lambert') {
      this.material = LAMBERT_WHITE;
    }
    else if (this.App.config.material == 'iridescent') {
      this.material = iriMaterial;
    }
    else {
    }

    this.mesh.material = this.material;
  }

  makeMesh() {
    var geom = new THREE.Geometry();
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.geometry.dynamic = true;
    this.scene.add(this.mesh);
  }

  updateMesh() {
    let vertices = [];
    let faces = [];
    for (var j = 0; j < this.voxels.length; j++) {
      var v = this.voxels[j];
      var {vPos, vNor} = v.polygonize(this.isolevel, this.sample.bind(this));
      for (var i = 0; i < vPos.length / 3; i++) {
        vertices.push(vPos[3*i], vPos[3*i+1], vPos[3*i+2]);
        var normals = [vNor[3*i], vNor[3*i+1], vNor[3 * i + 2]];
        var fl = faces.length;
        faces.push(new THREE.Face3(fl * 3, fl * 3 + 1, fl * 3 + 2, normals));
      }
    }
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
    var halfGridCellWidth = this.gridCellWidth / 2.0;
    var x = this.pos.x;
    var y = this.pos.y;
    var z = this.pos.z;
    var red = 0xff0000;

    this.val = [];
    // Center dot
    this.val[0] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.val[1] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.val[2] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.val[3] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.val[4] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.val[5] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.val[6] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.val[7] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    
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

  VertexInterp(isolevel, posA, posB) {
    
    var lerpPos = THREE.Vector3(0, 0, 0);
    if (Math.abs(isolevel - posA.isovalue) < 0.0001) {
      return posA.pos;
    }
    if (Math.abs(isolevel - posB.isovalue) < 0.0001) {
      return posB.pos;
    }
    if (Math.abs(posA.isovalue - posB.isovalue) < 0.0001) {
      return posA.pos;
    }
    var mu = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
    var x = posA.pos.x + mu * (posB.pos.x - posA.pos.x);
    var y = posA.pos.y + mu * (posB.pos.y - posA.pos.y);
    var z = posA.pos.z + mu * (posB.pos.z - posA.pos.z);
    return new THREE.Vector3(x, y, z);
  }

  polygonize(isolevel, sample) {

    // @TODO
    
    let vPos = [];
    let vNor = [];
    let vertexList = [];
    var cubeIdx = 0;
    if (this.val[0].isovalue < isolevel) cubeIdx |= 1;
    if (this.val[1].isovalue < isolevel) cubeIdx |= 2;
    if (this.val[2].isovalue < isolevel) cubeIdx |= 4;
    if (this.val[3].isovalue < isolevel) cubeIdx |= 8;
    if (this.val[4].isovalue < isolevel) cubeIdx |= 16;
    if (this.val[5].isovalue < isolevel) cubeIdx |= 32;
    if (this.val[6].isovalue < isolevel) cubeIdx |= 64;
    if (this.val[7].isovalue < isolevel) cubeIdx |= 128;

    var edges = LUT.EDGE_TABLE[cubeIdx];
    if (edges == 0) {
       return { vPos, vNor };
    }

   if (edges & 1)
      vertexList[0] =
         this.VertexInterp(isolevel, this.val[0], this.val[1]);
   if (edges & 2)
      vertexList[1] =
         this.VertexInterp(isolevel, this.val[1], this.val[2]);
   if (edges & 4)
      vertexList[2] =
         this.VertexInterp(isolevel, this.val[2], this.val[3]);
   if (edges & 8)
      vertexList[3] =
         this.VertexInterp(isolevel, this.val[3], this.val[0]);
   if (edges & 16)
      vertexList[4] =
         this.VertexInterp(isolevel, this.val[4], this.val[5]);
   if (edges & 32)
      vertexList[5] =
         this.VertexInterp(isolevel, this.val[5], this.val[6]);
   if (edges & 64)
      vertexList[6] =
         this.VertexInterp(isolevel, this.val[6], this.val[7]);
   if (edges & 128)
      vertexList[7] =
         this.VertexInterp(isolevel, this.val[7], this.val[4]);
   if (edges & 256)
      vertexList[8] =
         this.VertexInterp(isolevel, this.val[0], this.val[4]);
   if (edges & 512)
      vertexList[9] =
         this.VertexInterp(isolevel, this.val[1], this.val[5]);
   if (edges & 1024)
      vertexList[10] =
         this.VertexInterp(isolevel, this.val[2], this.val[6]);
   if (edges & 2048)
      vertexList[11] =
         this.VertexInterp(isolevel, this.val[3], this.val[7]);
    for (let i = 0; i < 16; i++) {
      if (LUT.TRI_TABLE[16 * cubeIdx + i] < 0) break;
      let point = vertexList[LUT.TRI_TABLE[16 * cubeIdx + i]];
      let samp = sample(point);
      let delta = v3(sample(v3(-E,0,0).add(point)), sample(v3(0,-E,0).add(point)), sample(v3(0,0,-E).add(point)));
      let normal = delta.subScalar(samp).normalize();
      vPos.push(point);
      vNor.push(normal);
    }
    return { vPos, vNor };
  };
}