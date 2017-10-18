const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;
var EPSILON = 0.00001;
var tempPoint = new THREE.Vector3(0,0,0);

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );
const PHONG = new THREE.MeshPhongMaterial({color: 0x616161, specular: 0x707070, shininess : 10});


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
    this.mesh = new THREE.Mesh(new THREE.Geometry(), PHONG);

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

  i1toi2(i1) {

    // [i % w, i % (h * w)) / w, i / (h * w)]

    // @note: ~~ is a fast substitute for Math.floor()
    return [
      i1 % this.res,
      ~~ ((i1 % this.res2) / this.res)
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

  i2toPos(i2) {

    return new THREE.Vector3(
      i2[0] * this.gridCellWidth + this.origin.x + this.halfCellWidth,
      i2[1] * this.gridCellWidth + this.origin.y + this.halfCellWidth,
      0
      );
  };


  // setupCells() {
  //   // Allocate voxels based on our grid resolution
  //   this.voxels = [];
  //   for (var i = 0; i < this.res3; i++) {
  //     var i3 = this.i1toi3(i);
  //     var {x, y, z} = this.i3toPos(i3);
  //     var voxel = new Voxel(new THREE.Vector3(x, y, z), this.gridCellWidth);
  //     this.voxels.push(voxel);

  //     if (VISUAL_DEBUG) {
  //       this.scene.add(voxel.wireframe);
  //       this.scene.add(voxel.mesh);
  //     }
  //   }    
  // }
  setupCells() {
    // Allocate voxels based on our grid resolution
    this.voxels = [];
    for (var i = 0; i < this.res2*10; i++) {
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
    /*for (var i = 0; i < this.numMetaballs; i++) {
      x = this.gridWidth / 2;    
      y = this.gridWidth / 2;    
      z = this.gridWidth / 2;    
      pos = new THREE.Vector3(x, y, z);
      
      vx = (Math.random() * 2 - 1) * this.maxSpeed;
      vy = (Math.random() * 2 - 1) * this.maxSpeed;
      vz = (Math.random() * 2 - 1) * this.maxSpeed;
      vel = new THREE.Vector3(vx, vy, vz);
      
      radius = Math.random() * (this.maxRadius - this.minRadius) + this.minRadius;
  
      var ball = new Metaball(pos, radius, vel, this.gridWidth, this.maxRadius, VISUAL_DEBUG);
      this.balls.push(ball);
      
      if (VISUAL_DEBUG) {
        this.scene.add(ball.mesh);
      }
    }*/
    var angleOffset = 2.0 * Math.PI / this.numMetaballs;
    var origin = this.gridWidth / 2;
    for (var i = 0; i < this.numMetaballs; i++) {
      
      var radius = this.gridWidth / 2 - this.maxRadius*2-1;
      x = origin + radius * Math.cos(angleOffset*i);
      y = origin + radius * Math.sin(angleOffset*i);
      z = 3;
      //x = this.gridWidth / 2;    
      //y = this.gridWidth / 2;    
      //z = this.gridWidth / 2;    
      pos = new THREE.Vector3(x, y, z);
      
      vx = 0;
      vy = 0;
      vz = 0;
      //vx = 1 * Math.cos(.25) - 1 * Math.sin(.25);
      //vz = 1 * Math.cos(.25) + 1 * Math.sin(.25);
      //vx = (Math.random() * 2 - 1) * this.maxSpeed;
      //vy = (Math.random() * 2 - 1) * this.maxSpeed;
      //vz = (Math.random() * 2 - 1) * this.maxSpeed;
      vel = new THREE.Vector3(vx, vy, vz);
      
      radius = Math.random() * (this.maxRadius - this.minRadius) + this.minRadius;
  
      var ball = new Metaball(pos, radius, vel, this.gridWidth, this.maxRadius, VISUAL_DEBUG);
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
    
    this.balls.forEach(function(ball) {      
      var distance = ball.pos.distanceTo(point);
      isovalue += ball.radius2 / (distance * distance);
    });
    
    return isovalue;
  }

  samplePointAsArray(point, balls) {
    var isovalue = 0.0;    
    tempPoint.x = point[0];
    tempPoint.y = point[1];
    tempPoint.z = point[2];
    balls.forEach(function(ball) {      
      var distance = ball.pos.distanceTo(tempPoint);
      isovalue += ball.radius2 / (distance * distance);
    });
    
    return isovalue;
  }

  update() {

    if (this.isPaused) {
      return;
    }

    // This should move the metaballs
    // this.balls.forEach(function(ball) {
    //   ball.update();
    // });
    for (var i = 0; i < this.balls.length; i++) {
      this.balls[i].update(i);
    }

    for (var c = 0; c < this.res2*10; c++) {
      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);
      for (var i = 0; i < 8; i++)
        this.voxels[c].corners[i].isovalue = this.sample(this.voxels[c].corners[i].pos);
      
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

    var mat = new THREE.ShaderMaterial({
      uniforms: {
        texture: {
          type: "t", 
          value: null
        },
        u_albedo: {
          type: 'v3',
          value: new THREE.Color(0xff0000)
        }
      },
      vertexShader: require('./glsl/litsphere-vert.glsl'),
      fragmentShader: require('./glsl/litsphere-frag.glsl')
    });
         
    var textureLoaded = new Promise((resolve, reject) => {
      (new THREE.TextureLoader()).load(require('./images/metal.bmp'), function(texture) {
        resolve(texture);
      })
    })

    textureLoaded.then(function(texture) {
      mat.uniforms.texture.value = texture;
    });

    this.mesh.material = mat;
    this.scene.add(this.mesh);  
  }

  updateMesh() {
    var vertices = [];
    var faces = [];
    
    for (var i = 0; i < this.voxels.length; i++) {
        
      var object = this.voxels[i].polygonize(this.isolevel, this.samplePointAsArray, this.balls);
      if (object.vertPositions.length > 0) {
        
        var offset = vertices.length;
        
        for (var j= 0; j < object.vertPositions.length; j += 3) {
          
          var v1 = object.vertPositions[j];
          var v2 = object.vertPositions[j+1];
          var v3 = object.vertPositions[j+2];

          vertices.push(v1);
          vertices.push(v2);
          vertices.push(v3);
          
          var face = new THREE.Face3(offset+j, offset+j+1, offset+j+2);
          
          face.vertexNormals[0] = object.vertNormals[j];
          face.vertexNormals[1] = object.vertNormals[j+1];
          face.vertexNormals[2] = object.vertNormals[j+2];
          faces.push(face);
          
        }  
        
      }
      
    }
  
    this.mesh.geometry.vertices = vertices;
    this.mesh.geometry.faces = faces;
    this.mesh.geometry.dynamic = true;
    this.mesh.geometry.verticesNeedUpdate = true;
    this.mesh.geometry.elementsNeedUpdate = true;
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
    this.vertexList = [];
    this.normalList = [];

    for (var i = 0; i < 12; i++) {
      this.vertexList[i] = new THREE.Vector3(0,0,0);
      this.normalList[i] = new THREE.Vector3(0,0,0);
    }

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
    
    //bottom points
    this.corners[0] = new InspectPoint(new THREE.Vector3(x-halfGridCellWidth, 
                                                   y-halfGridCellWidth, 
                                                   z-halfGridCellWidth), 0, VISUAL_DEBUG); 
    this.corners[1] = new InspectPoint(new THREE.Vector3(x+halfGridCellWidth, 
                                                   y-halfGridCellWidth, 
                                                   z-halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[2] = new InspectPoint(new THREE.Vector3(x+halfGridCellWidth, 
                                                   y-halfGridCellWidth, 
                                                   z+halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[3] = new InspectPoint(new THREE.Vector3(x-halfGridCellWidth, 
                                                   y-halfGridCellWidth, 
                                                   z+halfGridCellWidth), 0, VISUAL_DEBUG);
    
    //top points
    this.corners[4] = new InspectPoint(new THREE.Vector3(x-halfGridCellWidth, 
                                                   y+halfGridCellWidth, 
                                                   z-halfGridCellWidth), 0, VISUAL_DEBUG); 
    this.corners[5] = new InspectPoint(new THREE.Vector3(x+halfGridCellWidth, 
                                                   y+halfGridCellWidth, 
                                                   z-halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[6] = new InspectPoint(new THREE.Vector3(x+halfGridCellWidth, 
                                                   y+halfGridCellWidth, 
                                                   z+halfGridCellWidth), 0, VISUAL_DEBUG);
    this.corners[7] = new InspectPoint(new THREE.Vector3(x-halfGridCellWidth, 
                                                   y+halfGridCellWidth, 
                                                   z+halfGridCellWidth), 0, VISUAL_DEBUG);
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

  vertexInterpolation(isovalue, posA, posB, vertex) {

    var mu;

    if (Math.abs(isovalue-posA.isovalue) < EPSILON)
      return(posA.pos);
    if (Math.abs(isovalue-posB.isovalue) < EPSILON)
      return(posB.pos);
    if (Math.abs(posA.isolevel-posB.isovalue) < EPSILON)
      return(posA.pos);
    
    mu = (isovalue - posA.isovalue) / (posB.isovalue - posA.isovalue);
    vertex.x = posA.pos.x + mu * (posB.pos.x - posA.pos.x);
    vertex.y = posA.pos.y + mu * (posB.pos.y - posA.pos.y);
    vertex.z = posA.pos.z + mu * (posB.pos.z - posA.pos.z);
  }
  
  getNormal(pos, sample2, balls, normal) {
        
    normal.x = sample2([pos.x + EPSILON, pos.y, pos.z], balls)
              - sample2([pos.x - EPSILON, pos.y, pos.z], balls);
    normal.y = sample2([pos.x, pos.y + EPSILON, pos.z], balls)
              - sample2([pos.x, pos.y - EPSILON, pos.z], balls);   
    normal.z = sample2([pos.x, pos.y, pos.z + EPSILON], balls)
              - sample2([pos.x, pos.y, pos.z - EPSILON], balls);

    normal.normalize();
  }

  polygonize(isolevel, sample2, balls) {
    
    var voxelIndex = 0;
        
    if (this.corners[0].isovalue < isolevel) voxelIndex |= 1;
    if (this.corners[1].isovalue < isolevel) voxelIndex |= 2;
    if (this.corners[2].isovalue < isolevel) voxelIndex |= 4;
    if (this.corners[3].isovalue < isolevel) voxelIndex |= 8;
    if (this.corners[4].isovalue < isolevel) voxelIndex |= 16;
    if (this.corners[5].isovalue < isolevel) voxelIndex |= 32;
    if (this.corners[6].isovalue < isolevel) voxelIndex |= 64;
    if (this.corners[7].isovalue < isolevel) voxelIndex |= 128;


    if (LUT.EDGE_TABLE[voxelIndex] == 0)
      return {
        vertPositions: [],
        vertNormals: []
      };

    if (LUT.EDGE_TABLE[voxelIndex] & 1) {
      this.vertexInterpolation(isolevel, 
        this.corners[0], this.corners[1], this.vertexList[0]);
      this.getNormal(this.vertexList[0], sample2, balls, this.normalList[0]);
    }

    if (LUT.EDGE_TABLE[voxelIndex] & 2) {
      this.vertexInterpolation(isolevel, 
        this.corners[1], this.corners[2], this.vertexList[1]);
      this.getNormal(this.vertexList[1], sample2, balls, this.normalList[1]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 4) {
      this.vertexInterpolation(isolevel, 
        this.corners[2], this.corners[3], this.vertexList[2]);
      this.getNormal(this.vertexList[2], sample2, balls, this.normalList[2]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 8) {
      this.vertexInterpolation(isolevel, 
        this.corners[3], this.corners[0], this.vertexList[3]);
      this.getNormal(this.vertexList[3], sample2, balls, this.normalList[3]);
    }
    
    
    if (LUT.EDGE_TABLE[voxelIndex] & 16) {
      this.vertexInterpolation(isolevel, 
        this.corners[4], this.corners[5], this.vertexList[4]);
      this.getNormal(this.vertexList[4], sample2, balls, this.normalList[4]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 32) {
      this.vertexInterpolation(isolevel, 
        this.corners[5], this.corners[6], this.vertexList[5]);
      this.getNormal(this.vertexList[5], sample2, balls, this.normalList[5]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 64) {
      this.vertexInterpolation(isolevel, 
        this.corners[6], this.corners[7], this.vertexList[6]);
      this.getNormal(this.vertexList[6], sample2, balls, this.normalList[6]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 128) {
      this.vertexInterpolation(isolevel, 
        this.corners[7], this.corners[4], this.vertexList[7]);
      this.getNormal(this.vertexList[7], sample2, balls, this.normalList[7]);
    }
    
    
    if (LUT.EDGE_TABLE[voxelIndex] & 256) {
      this.vertexInterpolation(isolevel, 
        this.corners[0], this.corners[4], this.vertexList[8]);
      this.getNormal(this.vertexList[8], sample2, balls, this.normalList[8]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 512) {
      this.vertexInterpolation(isolevel, 
        this.corners[1], this.corners[5], this.vertexList[9]);
      this.getNormal(this.vertexList[9], sample2, balls, this.normalList[9]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 1024) {
      this.vertexInterpolation(isolevel, 
        this.corners[2], this.corners[6], this.vertexList[10]);
      this.getNormal(this.vertexList[10], sample2, balls, this.normalList[10]);
    }
    if (LUT.EDGE_TABLE[voxelIndex] & 2048) {
      this.vertexInterpolation(isolevel, 
        this.corners[3], this.corners[7], this.vertexList[11]);
      this.getNormal(this.vertexList[11], sample2, balls, this.normalList[11]);
    }

    var vertPositions = [];
    var vertNormals = [];
    
    for (var i = 0; LUT.TRI_TABLE[voxelIndex*16+i] != -1; i += 3) {
      vertPositions.push(this.vertexList[LUT.TRI_TABLE[voxelIndex*16+i]]);
      vertPositions.push(this.vertexList[LUT.TRI_TABLE[voxelIndex*16+i+1]]);
      vertPositions.push(this.vertexList[LUT.TRI_TABLE[voxelIndex*16+i+2]]);
      vertNormals.push(this.normalList[LUT.TRI_TABLE[voxelIndex*16+i]]);
      vertNormals.push(this.normalList[LUT.TRI_TABLE[voxelIndex*16+i+1]]);
      vertNormals.push(this.normalList[LUT.TRI_TABLE[voxelIndex*16+i+2]]);
    }

    //console.log(vertPositions);
    
    return {
      vertPositions: vertPositions,
      vertNormals: vertNormals
    };
  };
}