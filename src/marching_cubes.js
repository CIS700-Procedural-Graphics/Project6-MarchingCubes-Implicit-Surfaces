const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );
const NORMAL_OFFSET = 0.01; 

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
    // options for lambert shader
    var options = {
        lightColor: '#ffffff',
        lightIntensity: 2,
        albedo: '#dddddd',
        ambient: '#111111'
    }

    var iridescentMaterial = new THREE.ShaderMaterial({
          uniforms: {
              u_albedo: {
                  type: 'v3',
                  value: new THREE.Color(options.albedo)
              },
              u_ambient: {
                  type: 'v3',
                  value: new THREE.Color(options.ambient)
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
                  value: App.camera.position
              }
          },
          vertexShader: require('./glsl/lambert-vert.glsl'),
          fragmentShader: require('./glsl/iridescent-frag.glsl')
      });

    this.customShaderOn = App.resetWithCustomShader;

    if (App.resetWithCustomShader) {
      this.material = iridescentMaterial;
    } else {
      this.material = new THREE.MeshNormalMaterial();
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
    var isovalue = 0;
    for (var i = 0; i < this.balls.length; i++) {
      var ri_squared = Math.pow(this.balls[i].radius, 2);
      var x = Math.pow(point.x - this.balls[i].pos.x, 2);  
      var y = Math.pow(point.y - this.balls[i].pos.y, 2);  
      var z = Math.pow(point.z - this.balls[i].pos.z, 2); 
      isovalue += (ri_squared / (x + y + z)); 
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

    var vertices = [];
    var normals = [];

    for (var c = 0; c < this.res3; c++) {
      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);
      //Sampling the 8 corners 
      for (var j = 0; j < this.voxels[c].corners.length; j++) {
        this.voxels[c].corners[j].isovalue = this.sample(this.voxels[c].corners[j].pos);
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

      var polyResults = this.voxels[c].polygonize(this.isolevel);
      polyResults.vertNormals = [];
      for (var i = 0; i < polyResults.vertPositions.length; i++) {
        // calculate normals by sampling each vertex of the triangle
        var v = this.sample(polyResults.vertPositions[i]);
        
        var offsetXPt;
        if (polyResults.vertPositions[i].x > 0) {
          offsetXPt = new THREE.Vector3(polyResults.vertPositions[i].x + NORMAL_OFFSET, polyResults.vertPositions[i].y, polyResults.vertPositions[i].z); 
        } else {
          offsetXPt = new THREE.Vector3(polyResults.vertPositions[i].x - NORMAL_OFFSET, polyResults.vertPositions[i].y, polyResults.vertPositions[i].z); 
        }
        var v1 = this.sample(offsetXPt);
        
        var offsetYPt;
        if (polyResults.vertPositions[i].y > 0) {
          offsetYPt = new THREE.Vector3(polyResults.vertPositions[i].x, polyResults.vertPositions[i].y + NORMAL_OFFSET, polyResults.vertPositions[i].z); 
        } else {
          offsetYPt = new THREE.Vector3(polyResults.vertPositions[i].x, polyResults.vertPositions[i].y - NORMAL_OFFSET, polyResults.vertPositions[i].z); 
        }
        var v2 = this.sample(offsetYPt);
        
        var offsetZPt;
        if (polyResults.vertPositions[i].z >= 0) {
          offsetZPt = new THREE.Vector3(polyResults.vertPositions[i].x, polyResults.vertPositions[i].y, polyResults.vertPositions[i].z + NORMAL_OFFSET); 
        } else {
          offsetZPt = new THREE.Vector3(polyResults.vertPositions[i].x, polyResults.vertPositions[i].y, polyResults.vertPositions[i].z - NORMAL_OFFSET); 
        }

        var v3 = this.sample(offsetZPt);
        var sampledPts = new THREE.Vector3(v1, v2, v3);
        sampledPts.subScalar(v);
        sampledPts.normalize();
        polyResults.vertNormals.push(sampledPts);
        vertices.push(polyResults.vertPositions[i]);
        normals.push(sampledPts);
      }
    }

    this.updateMesh(vertices, normals);
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
    var geom = new THREE.Geometry(); 
    var v1 = new THREE.Vector3(5,0,0);
    var v2 = new THREE.Vector3(0,5,0);
    var v3 = new THREE.Vector3(0,5,5);

    geom.vertices.push(v1);
    geom.vertices.push(v2);
    geom.vertices.push(v3);

    geom.faces.push( new THREE.Face3( 0, 1, 2 ) );
    geom.computeFaceNormals();

    var object = new THREE.Mesh( geom, new THREE.MeshNormalMaterial() );
    object.name = "mesh";
    this.scene.add(object);
  }

  updateMesh(vertices, normals) {
    var obj = this.scene.getObjectByName("mesh");
    this.scene.remove(obj);

    var f_normals = new Float32Array( normals.length * 3 );
    var geom = new THREE.Geometry();
    var normalsCtr = 0; 
    for (var i = 0; i < vertices.length; i+=3) {
      geom.vertices.push(vertices[i]);
      geom.vertices.push(vertices[i+1]);
      geom.vertices.push(vertices[i+2]);
      var face = new THREE.Face3( i, i+1, i+2 );
      geom.faces.push(face);
      if (this.customShaderOn) {
        f_normals[i] = normals[normalsCtr].x;
        f_normals[i+1] = normals[normalsCtr].y;
        f_normals[i+2] = normals[normalsCtr].z;
        normalsCtr++;
      } else {
        geom.computeFaceNormals();
      }
    }

    var bufferGeom = new THREE.BufferGeometry();
    bufferGeom.fromGeometry(geom);
    bufferGeom.addAttribute( 'computedNormal', new THREE.BufferAttribute( f_normals, 3 ) );
    var updatedObj = new THREE.Mesh( bufferGeom, this.material);

    updatedObj.name = "mesh";
    this.scene.add(updatedObj);

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
    // bottom 4 dots
    var bottomLeftBack = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    var bottomLeftFront = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    var bottomRightBack = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    var bottomRightFront = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    
    // top 4 dots
    var topLeftBack = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    var topLeftFront = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    var topRightBack = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    var topRightFront = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners = [bottomLeftBack, bottomRightBack, bottomRightFront, bottomLeftFront, topLeftBack, topRightBack, topRightFront, topLeftFront];
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
    var p1 = posA.pos; 
    var p2 = posB.pos;
    var iv1 = posA.isovalue;
    var iv2 = posB.isovalue;

    if (Math.abs(isolevel - iv1) < 0.00001 || Math.abs(iv1-iv2) < 0.00001) {
      return p1;
    }
    if (Math.abs(isolevel - iv2) < 0.00001) {
      return p2;
    }

    var f = (isolevel - iv1)/(iv2 - iv1);

    var lerpPos = new THREE.Vector3();
    lerpPos.x = p1.x + f * (p2.x - p1.x);
    lerpPos.y = p1.y + f * (p2.y - p1.y);
    lerpPos.z = p1.z + f * (p2.z - p1.z);

    return lerpPos;
  }

  polygonize(isolevel) {
    var cubeIndex = 0;
    if (this.corners[0].isovalue < isolevel) cubeIndex |= 1;
    if (this.corners[1].isovalue < isolevel) cubeIndex |= 2;
    if (this.corners[2].isovalue < isolevel) cubeIndex |= 4;
    if (this.corners[3].isovalue < isolevel) cubeIndex |= 8;
    if (this.corners[4].isovalue < isolevel) cubeIndex |= 16;
    if (this.corners[5].isovalue < isolevel) cubeIndex |= 32;
    if (this.corners[6].isovalue < isolevel) cubeIndex |= 64;
    if (this.corners[7].isovalue < isolevel) cubeIndex |= 128;

    var edgeLookup = LUT.EDGE_TABLE[cubeIndex];
    if (edgeLookup == 0) {
      return { vertPositions: [], vertNormals: []};
    } 

    var vertexList = [];
    var normalList = [];

    if (edgeLookup & 1) {
      vertexList[0] = this.vertexInterpolation(isolevel, this.corners[0], this.corners[1]);
    }
    if (edgeLookup & 2) {
      vertexList[1] = this.vertexInterpolation(isolevel, this.corners[1], this.corners[2]);
    }
    if (edgeLookup & 4) {
      vertexList[2] = this.vertexInterpolation(isolevel, this.corners[2], this.corners[3]);
    }
    if (edgeLookup & 8) {
      vertexList[3] = this.vertexInterpolation(isolevel, this.corners[3], this.corners[0]);
    }
    if (edgeLookup & 16) {
      vertexList[4] = this.vertexInterpolation(isolevel, this.corners[4], this.corners[5]);
    }
    if (edgeLookup & 32) {
      vertexList[5] = this.vertexInterpolation(isolevel, this.corners[5], this.corners[6]);
    }
    if (edgeLookup & 64) {
      vertexList[6] = this.vertexInterpolation(isolevel, this.corners[6], this.corners[7]);
    }
    if (edgeLookup & 128) {
      vertexList[7] = this.vertexInterpolation(isolevel, this.corners[7], this.corners[4]);
    }
    if (edgeLookup & 256) {
      vertexList[8] = this.vertexInterpolation(isolevel, this.corners[0], this.corners[4]);
    }
    if (edgeLookup & 512) {
      vertexList[9] = this.vertexInterpolation(isolevel, this.corners[1], this.corners[5]);
    }
    if (edgeLookup & 1024) {
      vertexList[10] = this.vertexInterpolation(isolevel, this.corners[2], this.corners[6]);
    }
    if (edgeLookup & 2048) {
      vertexList[11] = this.vertexInterpolation(isolevel, this.corners[3], this.corners[7]);
    }

    var finalVertexPositions = []; 

    var i = 0; 
    var adjustedIndex = cubeIndex*16; 
    while (LUT.TRI_TABLE[adjustedIndex + i] != -1) {
      finalVertexPositions[i] = vertexList[LUT.TRI_TABLE[adjustedIndex + i]];
      finalVertexPositions[i+1] = vertexList[LUT.TRI_TABLE[adjustedIndex + i + 1]];
      finalVertexPositions[i+2] = vertexList[LUT.TRI_TABLE[adjustedIndex + i + 2]];
      i+=3;
    }

    return {
      vertPositions: finalVertexPositions,
      vertNormals: normalList
    };
  };
}