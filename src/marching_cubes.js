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
      isovalue += (this.balls[i].radius2) / point.distanceToSquared(this.balls[i].pos);
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
      //sampling the corners
      this.voxels[c].v0.isovalue = this.sample(this.voxels[c].v0.pos);
      this.voxels[c].v1.isovalue = this.sample(this.voxels[c].v1.pos);
      this.voxels[c].v2.isovalue = this.sample(this.voxels[c].v2.pos);
      this.voxels[c].v3.isovalue = this.sample(this.voxels[c].v3.pos);
      this.voxels[c].v4.isovalue = this.sample(this.voxels[c].v4.pos);
      this.voxels[c].v5.isovalue = this.sample(this.voxels[c].v5.pos);
      this.voxels[c].v6.isovalue = this.sample(this.voxels[c].v6.pos);
      this.voxels[c].v7.isovalue = this.sample(this.voxels[c].v7.pos);   

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {
        
        // Toggle voxels on or off
        if (this.voxels[c].center.isovalue > this.isolevel) {
          this.voxels[c].show();
        } 
        else {
          this.voxels[c].hide();
        }

        //this.voxels[c].center.updateLabel(this.camera);

        this.voxels[c].v0.updateLabel(this.camera);
        this.voxels[c].v1.updateLabel(this.camera);
        this.voxels[c].v2.updateLabel(this.camera);
        this.voxels[c].v3.updateLabel(this.camera);
        this.voxels[c].v4.updateLabel(this.camera);
        this.voxels[c].v5.updateLabel(this.camera);
        this.voxels[c].v6.updateLabel(this.camera);
        this.voxels[c].v7.updateLabel(this.camera);

      } 
      else {

        //this.voxels[c].center.clearLabel();

        this.voxels[c].v0.clearLabel();
        this.voxels[c].v1.clearLabel();
        this.voxels[c].v2.clearLabel();
        this.voxels[c].v3.clearLabel();
        this.voxels[c].v4.clearLabel();
        this.voxels[c].v5.clearLabel();
        this.voxels[c].v6.clearLabel();
        this.voxels[c].v7.clearLabel();
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
    var material = new THREE.ShaderMaterial( {
      uniforms: {
        /*
          // float initialized to 0
          time: { type: "f", value: 0.0 },
          // float initialized to 0
          freq: { type: "f", value: 0.0 },
          //float initialized to 25
          amp: { type: "f", value: 10.0 }
        */
      },
      vertexShader: require('./shaders/iridescence-vert.glsl'),
      fragmentShader: require('./shaders/iridescence-frag.glsl')
    });

    this.mesh = new THREE.Mesh(new THREE.Geometry(), material);
    this.mesh.geometry.dynamic = true;
    this.scene.add(this.mesh);
  }

  updateMesh() {
    var newVertices = [];
    var newFaces = [];
    var nFace = 0;
    this.voxels.forEach(v => {
      var {vertexPositions, vertexNormals} = v.polygonize(this.isolevel, this.sample.bind(this));
      for (let i = 0; i < vertexPositions.length/3; i++) {
        newVertices.push(vertexPositions[3 * i], vertexPositions[3 * i + 1], vertexPositions[3 * i + 2]);
        var normals = [vertexNormals[3 * i], vertexNormals[3 * i + 1], vertexNormals[3 * i + 2]];
        newFaces.push(new THREE.Face3(3*nFace, 3*nFace+1, 3*nFace+2, normals));
        nFace++;
      }
    });
    
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

    //corners
    this.v0 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.v1 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.v2 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.v3 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);

    this.v4 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.v5 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.v6 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.v7 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
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

  //posA and posB are InspectPoints
  vertexInterpolation(isolevel, posA, posB) {
    if (Math.abs(isolevel - posA.isovalue) == 0.0) {
      return new THREE.Vector3(posA.pos);
    }
    else if (Math.abs(isolevel - posB.isovalue) == 0.0) {
      return new THREE.Vector3(posB.pos);
    }
    else if (Math.abs(posA.isovalue-posB.isovalue) == 0.0) {
      return new THREE.Vector3(posA.pos);
    }
    else {
      var t = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
      return new THREE.Vector3(posA.pos.x + t*(posB.pos.x - posA.pos.x), posA.pos.y + t*(posB.pos.y - posA.pos.y), posA.pos.z + t*(posB.pos.z - posA.pos.z));
    }
  }

  polygonize(isolevel, sample) {

    var vertexPositions = [];
    var vertexNormals = [];

    //Determine the index into the edge table which
    //tells us which vertices are inside of the surface
    var cubeindex = 0;
    if (this.v0.isovalue < isolevel) cubeindex |= 1;
    if (this.v1.isovalue < isolevel) cubeindex |= 2;
    if (this.v2.isovalue < isolevel) cubeindex |= 4;
    if (this.v3.isovalue < isolevel) cubeindex |= 8;
    if (this.v4.isovalue < isolevel) cubeindex |= 16;
    if (this.v5.isovalue < isolevel) cubeindex |= 32;
    if (this.v6.isovalue < isolevel) cubeindex |= 64;
    if (this.v7.isovalue < isolevel) cubeindex |= 128;
    

    // Cube is entirely in/out of the surface
    if (LUT.EDGE_TABLE[cubeindex] == 0) {
      return {
        vertexPositions,
        vertexNormals
      };
    }
    
    var vertlist = [];
    //Find the vertices where the surface intersects the cube
    //LUT.EDGE_TABLE gives you the edges that triangle vertices will be drawn on
    if (LUT.EDGE_TABLE[cubeindex] & 1)
      vertlist[0] = this.vertexInterpolation(isolevel, this.v0, this.v1);
    if (LUT.EDGE_TABLE[cubeindex] & 2)
      vertlist[1] = this.vertexInterpolation(isolevel, this.v1, this.v2);
    if (LUT.EDGE_TABLE[cubeindex] & 4)
      vertlist[2] = this.vertexInterpolation(isolevel, this.v2, this.v3);
    if (LUT.EDGE_TABLE[cubeindex] & 8)
      vertlist[3] = this.vertexInterpolation(isolevel, this.v3, this.v0);
    if (LUT.EDGE_TABLE[cubeindex] & 16)
      vertlist[4] = this.vertexInterpolation(isolevel, this.v4, this.v5);
    if (LUT.EDGE_TABLE[cubeindex] & 32)
      vertlist[5] = this.vertexInterpolation(isolevel, this.v5, this.v6);
    if (LUT.EDGE_TABLE[cubeindex] & 64)
      vertlist[6] = this.vertexInterpolation(isolevel, this.v6, this.v7);
    if (LUT.EDGE_TABLE[cubeindex] & 128)
      vertlist[7] = this.vertexInterpolation(isolevel, this.v7, this.v4);
    if (LUT.EDGE_TABLE[cubeindex] & 256)
      vertlist[8] = this.vertexInterpolation(isolevel, this.v0, this.v4);
    if (LUT.EDGE_TABLE[cubeindex] & 512)
      vertlist[9] = this.vertexInterpolation(isolevel, this.v1, this.v5);
    if (LUT.EDGE_TABLE[cubeindex] & 1024)
      vertlist[10] = this.vertexInterpolation(isolevel, this.v2, this.v6);
    if (LUT.EDGE_TABLE[cubeindex] & 2048)
      vertlist[11] = this.vertexInterpolation(isolevel, this.v3, this.v7);

    //Create the triangle and Compute the Normals
    //LUT.TRI_TABLE gives you order of vertices to input
    for (var i = 0; LUT.TRI_TABLE[16*cubeindex+i] != -1; i++) {

      var tri = LUT.TRI_TABLE[16 * cubeindex + i];
      var p0 = vertlist[tri];
      var samp = sample(p0);
      var delta = new THREE.Vector3(sample(new THREE.Vector3(-1e-5,0,0).add(p0)), 
                                    sample(new THREE.Vector3(0,-1e-5,0).add(p0)), 
                                    sample(new THREE.Vector3(0,0,-1e-5).add(p0)));
      var normal = delta.subScalar(samp).normalize();

      vertexPositions.push(p0);
      vertexNormals.push(normal);
    }

    return {
      vertexPositions,
      vertexNormals
    };

  };
}