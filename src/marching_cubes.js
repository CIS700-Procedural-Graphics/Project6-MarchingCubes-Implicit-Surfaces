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
    
    this.metaballMaterial = /*new THREE.MeshLambertMaterial();*/new THREE.ShaderMaterial({
      vertexShader: require('./shaders/iridiscence-vert.glsl'),
      fragmentShader: require('./shaders/iridiscence-frag.glsl')
    });
    
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
    var maxRadiusTripled = this.maxRadius * 3;
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
    
    var isovalue = 0;
    // Add up the total contribution from each metaball
    for(var i = 0; i < this.balls.length; i++) {
      var currentMetaball = this.balls[i];
      
      // Compute the displacement for each component
      var xDisplacement = currentMetaball.pos.x - point.x;
      var yDisplacement = currentMetaball.pos.y - point.y;
      var zDisplacement = currentMetaball.pos.z - point.z;
      
      // Compute the distance^2
      var distanceSq = xDisplacement * xDisplacement +
                       yDisplacement * yDisplacement +
                       zDisplacement * zDisplacement;
      
      // Distance-based falloff
      var currentContribution = currentMetaball.radius * currentMetaball.radius / distanceSq;
      // console.log(currentContribution);
      isovalue += currentContribution;
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
      
      //Sample the corners of each voxel
      this.voxels[c].Vzero.isovalue = this.sample(this.voxels[c].Vzero.pos);
      this.voxels[c].Vone.isovalue = this.sample(this.voxels[c].Vone.pos);
      this.voxels[c].Vtwo.isovalue = this.sample(this.voxels[c].Vtwo.pos);
      this.voxels[c].Vthree.isovalue = this.sample(this.voxels[c].Vthree.pos);
      this.voxels[c].Vfour.isovalue = this.sample(this.voxels[c].Vfour.pos);
      this.voxels[c].Vfive.isovalue = this.sample(this.voxels[c].Vfive.pos);
      this.voxels[c].Vsix.isovalue = this.sample(this.voxels[c].Vsix.pos);
      this.voxels[c].Vseven.isovalue = this.sample(this.voxels[c].Vseven.pos);
      
      this.voxels[c].metaballs = this.balls;
      
      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);
      
      //For now, show the voxel if any of the isovalues are above the isolevel, show the voxel

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {
        
        // Toggle voxels on or off
        if (this.voxels[c].center.isovalue > this.isolevel) {
          this.voxels[c].show();
        } else {
          this.voxels[c].hide();
        }
        this.voxels[c].center.updateLabel(this.camera);
        this.voxels[c].Vzero.updateLabel(this.camera);
        this.voxels[c].Vone.updateLabel(this.camera);
        this.voxels[c].Vtwo.updateLabel(this.camera);
        this.voxels[c].Vthree.updateLabel(this.camera);
        this.voxels[c].Vfour.updateLabel(this.camera);
        this.voxels[c].Vfive.updateLabel(this.camera);
        this.voxels[c].Vsix.updateLabel(this.camera);
        this.voxels[c].Vseven.updateLabel(this.camera);
      } else {
        this.voxels[c].center.clearLabel();
        this.voxels[c].Vzero.clearLabel();
        this.voxels[c].Vone.clearLabel();
        this.voxels[c].Vtwo.clearLabel();
        this.voxels[c].Vthree.clearLabel();
        this.voxels[c].Vfour.clearLabel();
        this.voxels[c].Vfive.clearLabel();
        this.voxels[c].Vsix.clearLabel();
        this.voxels[c].Vseven.clearLabel();
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
    //console.log(update);
    // @TODO
    //console.log('In make mesh');
    
    this.metaballGeometry = new THREE.Geometry();
    this.metaballGeometry.dynamic = true;
    this.metaballVoxelMesh = new THREE.Mesh( this.metaballGeometry, this.metaballMaterial/*new THREE.MeshLambertMaterial( { color : 0xdddddd, side : THREE.DoubleSide })*/);
    this.scene.add(this.metaballVoxelMesh);
  }

  updateMesh() {
    // @TODO
    this.metaballGeometry.dynamic = true;
    var triangleCount = 0;
    var vertList = new Array();
    var faceList = new Array();
    for (var c = 0; c < this.res3; c++) {
      var meshData = this.voxels[c].polygonize(this.isolevel);
      // console.log(meshData);
      
      if(meshData != 0) {
        //console.log('This voxel has some mesh data');
        // console.log(meshData.vertNormals);
        // Construct a THREE JS mesh
        // for(var v = 0; v < meshData.vertPositions.length; v++) {
        //   this.metaballGeometry.vertices.push(meshData.vertPositions[v]);
        // }
        // for(var n = 0; n < meshData.vertNormals.length; n++) {
        //   metaballGeometry.vertexNormals.push(meshData.vertNormals[n]);
        // }
        
        for(var t = 0; t < meshData.triangles.length; t++) {
          // console.log(meshData.triangles[t]);
          //this.metaballGeometry.faces.push( new THREE.Face3( meshData.triangles[t].x, meshData.triangles[t].y, meshData.triangles[t].z));
          var v1 = meshData.vertPositions[meshData.triangles[t].x];
          var v2 = meshData.vertPositions[meshData.triangles[t].y];
          var v3 = meshData.vertPositions[meshData.triangles[t].z];
          vertList.push(v1);
          vertList.push(v2);
          vertList.push(v3);
          var face = new THREE.Face3( 3 * triangleCount, 3 * triangleCount + 1, 3 * triangleCount + 2);
          // console.log(triangleCount);
          // if(meshData.vertNormals[3 * triangleCount].length() > 0) {
          //   console.log(meshData.vertNormals[3 * triangleCount]);
          // }
          // console.log(meshData.vertNormals);
          // console.log(meshData.vertNormals[3 * triangleCount]);
          face.vertexNormals[0] = meshData.vertNormals[meshData.triangles[t].x];
          face.vertexNormals[1] = meshData.vertNormals[meshData.triangles[t].y];
          face.vertexNormals[2] = meshData.vertNormals[meshData.triangles[t].z];
          faceList.push(face);
          // console.log(face);
          triangleCount++;
        }
      }
    }
    // console.log(vertList);
    this.metaballGeometry.vertices = vertList;
    // console.log(this.metaballGeometry.vertices);
    this.metaballGeometry.faces = faceList;
    // console.log(this.metaballGeometry.faces);
    //this.metaballGeometry.normals.....
    
    if(this.metaballVoxelMesh) {
      this.scene.remove(this.metaballVoxelMesh);
    }
    this.metaballGeometry.computeFaceNormals();
    this.metaballGeometry.verticesNeedUpdate = true;
    this.metaballGeometry.elementsNeedUpdate = true;
    //this.metaballVoxelMesh = new THREE.Mesh( this.metaballGeometry, this.metaballMaterial/*new THREE.MeshLambertMaterial( { color : 0xdddddd, side : THREE.DoubleSide })*/);
    this.scene.add(this.metaballVoxelMesh);
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
    
    // Each of the 8 corners of the voxel. Uses the convention defined by Paul Bourke
    this.Vzero = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.Vone = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.Vtwo = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.Vthree = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.Vfour = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.Vfive = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth), 0, VISUAL_DEBUG);
    this.Vsix = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
    this.Vseven = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth), 0, VISUAL_DEBUG);
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

  vertexInterpolation(isolevel, posA, posB, valA, valB) {

    // @TODO
    // Perform "reverse" linear interpolation to find the necessary weight
    // to find the point with isovalue equal to isolevel
    // Assume valA has the isovalue of below isolevel and valB is above
    // posA and posB have the respective values
    
    // console.log(valA);
    // console.log(valB);
    
    if(Math.abs(valB - valA) < 0.00001) {
      return posA;
    }
    
    var weight = (1 - valA) / (valB - valA);
    
    var lerpPos = new THREE.Vector3(0, 0, 0);
    
    lerpPos.x = (1 - weight) * posA.x + weight * posB.x;
    lerpPos.y = (1 - weight) * posA.y + weight * posB.y;
    lerpPos.z = (1 - weight) * posA.z + weight * posB.z;
    
    // console.log(lerpPos);
    // console.log(posA);
    // console.log(posB);
    // console.log(valA);
    // console.log(valB);
    // console.log(weight);
    
    return lerpPos;
  }

  polygonize(isolevel) { //pass in the isolevel threshold as defined in the App.config object, in main.js

    // @TODO
    var vertexList = [];
    var normalList = [];
    var triangleList = [];
    
    // Compute the index of this voxel into the edge table,
    // which is the number of vertices inside the isosurface.
    // This is done by comparing the isoValue each vertex of each voxel to the isolevel
    var cubeIndex = 0;
    if(this.Vzero.isovalue > isolevel) { cubeIndex |= 1; }
    if(this.Vone.isovalue > isolevel) { cubeIndex |= 2; }
    if(this.Vtwo.isovalue > isolevel) { cubeIndex |= 4; }
    if(this.Vthree.isovalue > isolevel) { cubeIndex |= 8; }
    if(this.Vfour.isovalue > isolevel) { cubeIndex |= 16; }
    if(this.Vfive.isovalue > isolevel) { cubeIndex |= 32; }
    if(this.Vsix.isovalue > isolevel) { cubeIndex |= 64; }
    if(this.Vseven.isovalue > isolevel) { cubeIndex |= 128; }
    
    //console.log(cubeIndex);
    
    var edgeValue = LUT.EDGE_TABLE[cubeIndex];
    
    //console.log(edgeValue);
    
    if(edgeValue == 0) {
      return 0; // this voxel is entirely outside of the surface
    }
    
    // At least part of this voxel is inside the surface
    // First add vertex positions to the array using the vertex interpolation function
    // This has to happen for each edge (12 times, so 12 if-statements), which is indicated by the 12 bit number retrieved from the lookup table in LUT
    
    // console.log(this.Vzero.isovalue);
    // console.log(this.Vone.isovalue);
    // console.log(this.Vtwo.isovalue);
    // console.log(this.Vthree.isovalue);
    // console.log(this.Vfour.isovalue);
    // console.log(this.Vfive.isovalue);
    // console.log(this.Vsix.isovalue);
    // console.log(this.Vseven.isovalue);
    
    if(edgeValue & 1) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vzero.pos, this.Vone.pos, this.Vzero.isovalue, this.Vone.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
      // call the function to compute normals given vertexPos
    } else {
      var vertexPos = new THREE.Vector3(0, 0, 0);
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 2) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vone.pos, this.Vtwo.pos, this.Vone.isovalue, this.Vtwo.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 4) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vtwo.pos, this.Vthree.pos, this.Vtwo.isovalue, this.Vthree.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 8) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vthree.pos, this.Vzero.pos, this.Vthree.isovalue, this.Vzero.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 16) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vfour.pos, this.Vfive.pos, this.Vfour.isovalue, this.Vfive.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 32) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vfive.pos, this.Vsix.pos, this.Vfive.isovalue, this.Vsix.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 64) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vsix.pos, this.Vseven.pos, this.Vsix.isovalue, this.Vseven.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 128) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vseven.pos, this.Vfour.pos, this.Vseven.isovalue, this.Vfour.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 256) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vzero.pos, this.Vfour.pos, this.Vzero.isovalue, this.Vfour.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 512) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vone.pos, this.Vfive.pos, this.Vone.isovalue, this.Vfive.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 1024) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vtwo.pos, this.Vsix.pos, this.Vtwo.isovalue, this.Vsix.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    if(edgeValue & 2048) {
      var vertexPos = this.vertexInterpolation(this.isolevel, this.Vthree.pos, this.Vseven.pos, this.Vthree.isovalue, this.Vseven.isovalue);
      vertexList.push(vertexPos);
      normalList.push(this.computeNormal(vertexPos));
      // normalList.push(new THREE.Vector3(0, 1, 0));
    } else {
      vertexList.push(vertexPos); //placeholder vector so that the triangle indices we use later on aren't skewed
      normalList.push(this.computeNormal(vertexPos));
    }
    
    // console.log(cubeIndex);
    // console.log(edgeValue);
    
    // Now create the list of vertices in each triangle using the indices retrieved from the triangle lookup table
    cubeIndex *= 16;
    for(var i = 0; LUT.TRI_TABLE[cubeIndex + i] != -1; i += 3) {
      var currentTriangle = new THREE.Vector3(0, 0, 0);
      currentTriangle.x = LUT.TRI_TABLE[cubeIndex + i];
      currentTriangle.y = LUT.TRI_TABLE[cubeIndex + i + 1];
      currentTriangle.z = LUT.TRI_TABLE[cubeIndex + i + 2];
      // console.log(currentTriangle);
      triangleList.push(currentTriangle);
    }
    
    // Compute normals using the gradient method
    // for(var t = 0; t < triangleList.length; t++) {
    //   // console.log(triangleList[t]);
    //   // console.log(vertexList[triangleList[t].x]);
    //   var n1 = this.computeNormal(vertexList[triangleList[t].x]);
    //   var n2 = this.computeNormal(vertexList[triangleList[t].y]);
    //   var n3 = this.computeNormal(vertexList[triangleList[t].z]);
    //   normalList.push(n1);
    //   normalList.push(n2);
    //   normalList.push(n3);
    //   normalList.push(this.computeNormal(vertexPos));
    // }
    
    // console.log(normalList);
    
    // Construction of the actual mesh for this voxel will occur in makeMesh
    // console.log(vertexList);
    return {
      vertPositions: vertexList,
      vertNormals: normalList,
      triangles: triangleList
    };
  };
  
  computeNormal(point) {
    // console.log(point);
    // Given a 3d point, sample the metaball distance function using an epsilon along each axis to obtain a gradient, which is effectively the geometric normal
    var epsilon = 0.0001;//1 / this.gridCellWidth;
    
    var xOffsetPlus = new THREE.Vector3(point.x + epsilon, point.y, point.z);
    var xOffsetMinus = new THREE.Vector3(point.x - epsilon, point.y, point.z);
    var yOffsetPlus = new THREE.Vector3(point.x, point.y + epsilon, point.z);
    var yOffsetMinus = new THREE.Vector3(point.x, point.y - epsilon, point.z);
    var zOffsetPlus = new THREE.Vector3(point.x, point.y, point.z + epsilon);
    var zOffsetMinus = new THREE.Vector3(point.x, point.y, point.z - epsilon);
    
    //.log(xOffsetPlus);
   // console.log(xOffsetMinus);
    
    var xGrad1 = this.sample(this.metaballs, xOffsetPlus);
    var xGrad2 = this.sample(this.metaballs, xOffsetMinus);
    //console.log(xGrad1);
      //  console.log(xGrad2);
    xGrad1 -= xGrad2;
    var yGrad1 = this.sample(this.metaballs, yOffsetPlus);
    var yGrad2 = this.sample(this.metaballs, yOffsetMinus);
    yGrad1 -= yGrad2;
    var zGrad1 = this.sample(this.metaballs, zOffsetPlus);
    var zGrad2 = this.sample(this.metaballs, zOffsetMinus);
    zGrad1 -= zGrad2;
    
    // console.log(xGrad1);
    // console.log(yGrad1);
    // console.log(zGrad1);
    
    var normal = new THREE.Vector3(xGrad1, yGrad1, zGrad1);
    // console.log(normal);
    normal.normalize();
    return normal;
  }
  
  sample(metaballs, point) {
    // Compute the metaball function at this point in space
    var isovalue = 0;
    for(var i = 0; i < metaballs.length; i++) {
      var currentMetaball = metaballs[i];
      
      // Compute the displacement for each component
      var xDisplacement = currentMetaball.pos.x - point.x;
      var yDisplacement = currentMetaball.pos.y - point.y;
      var zDisplacement = currentMetaball.pos.z - point.z;
      
      // Compute the distance^2
      var distanceSq = xDisplacement * xDisplacement +
                       yDisplacement * yDisplacement +
                       zDisplacement * zDisplacement;
      
      // Distance-based falloff
      var currentContribution = currentMetaball.radius * currentMetaball.radius / distanceSq;
      isovalue += currentContribution;
    }
    // console.log(isovalue);
    return isovalue;
  }
}