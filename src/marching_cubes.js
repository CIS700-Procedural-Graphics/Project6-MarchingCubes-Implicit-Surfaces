const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = true;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );
const LAMBERT_BLUE = new THREE.MeshLambertMaterial( { color: 0x2194ce } );

export default class MarchingCubes
{
  constructor(App)
  {
    this.init(App);
  }

  init(App)
  {
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
    for (var i = 0; i < this.res3; i++)
    {
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
  sample(point)
  {
    var isovalue = 0.0;

    for (var i = 0; i < this.numMetaballs; i++)
    {
      var dist = this.balls[i].pos.distanceTo(point);
      isovalue += this.balls[i].radius2/(dist*dist);
    }

    return isovalue;
  }

  sampleNormal(point)
  {
    // var isonormal = THREE.Vector3(0.0, 0.0, 0.0);
    var isovalueposdx;
    var isovaluenegdx;
    var isovalueposdy;
    var isovaluenegdy;
    var isovalueposdz;
    var isovaluenegdz;

    for (var i = 0; i < this.numMetaballs; i++)
    {
      var distposdx = this.balls[i].pos.distanceTo(point + new THREE.Vector3(0.00001, 0.0, 0.0));
      var distnegdx = this.balls[i].pos.distanceTo(point - new THREE.Vector3(0.00001, 0.0, 0.0));
      var distposdy = this.balls[i].pos.distanceTo(point + new THREE.Vector3(0.0, 0.00001, 0.0));
      var distnegdy = this.balls[i].pos.distanceTo(point - new THREE.Vector3(0.0, 0.00001, 0.0));
      var distposdz = this.balls[i].pos.distanceTo(point + new THREE.Vector3(0.0, 0.0, 0.00001));
      var distnegdz = this.balls[i].pos.distanceTo(point - new THREE.Vector3(0.0, 0.0, 0.00001));

      isovalueposdx += this.balls[i].radius2/(distposdx*distposdx);
      isovaluenegdx += this.balls[i].radius2/(distnegdx*distnegdx);
      isovalueposdy += this.balls[i].radius2/(distposdy*distposdy);
      isovaluenegdy += this.balls[i].radius2/(distnegdy*distnegdy);
      isovalueposdz += this.balls[i].radius2/(distposdz*distposdz);
      isovaluenegdz += this.balls[i].radius2/(distnegdz*distnegdz);
    }

    return (new THREE.Vector3( isovalueposdx - isovaluenegdx,
                               isovalueposdy - isovaluenegdy,
                               isovalueposdz - isovaluenegdz)).normalize();
  }

  update()
  {
    if (this.isPaused)
    {
      return;
    }

    // This should move the metaballs
    this.balls.forEach(function(ball)
    {
      ball.update();
    });

    for (var c = 0; c < this.res3; c++)
    {
      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);

      //Sampling at the vertices of the voxel instead
      //created 8 corner points inside the makeInspectPoints in voxel class
      this.voxels[c].corner0.isovalue = this.sample(this.voxels[c].corner0.pos);
      this.voxels[c].corner1.isovalue = this.sample(this.voxels[c].corner1.pos);
      this.voxels[c].corner2.isovalue = this.sample(this.voxels[c].corner2.pos);
      this.voxels[c].corner3.isovalue = this.sample(this.voxels[c].corner3.pos);
      this.voxels[c].corner4.isovalue = this.sample(this.voxels[c].corner4.pos);
      this.voxels[c].corner5.isovalue = this.sample(this.voxels[c].corner5.pos);
      this.voxels[c].corner6.isovalue = this.sample(this.voxels[c].corner6.pos);
      this.voxels[c].corner7.isovalue = this.sample(this.voxels[c].corner7.pos);

      this.voxels[c].corner0.isonormal = this.sampleNormal(this.voxels[c].corner0.pos);
      this.voxels[c].corner1.isonormal = this.sampleNormal(this.voxels[c].corner1.pos);
      this.voxels[c].corner2.isonormal = this.sampleNormal(this.voxels[c].corner2.pos);
      this.voxels[c].corner3.isonormal = this.sampleNormal(this.voxels[c].corner3.pos);
      this.voxels[c].corner4.isonormal = this.sampleNormal(this.voxels[c].corner4.pos);
      this.voxels[c].corner5.isonormal = this.sampleNormal(this.voxels[c].corner5.pos);
      this.voxels[c].corner6.isonormal = this.sampleNormal(this.voxels[c].corner6.pos);
      this.voxels[c].corner7.isonormal = this.sampleNormal(this.voxels[c].corner7.pos);

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid)
      {
        // Toggle voxels on or off
          // if (this.voxels[c].center.isovalue > this.isolevel) {
          //   this.voxels[c].show();
          // } else {
          //   this.voxels[c].hide();
          // }
        //   this.voxels[c].center.updateLabel(this.camera);
        // } else {
        //   this.voxels[c].center.clearLabel();
        // }

        this.voxels[c].corner0.updateLabel(this.camera);
        this.voxels[c].corner1.updateLabel(this.camera);
        this.voxels[c].corner2.updateLabel(this.camera);
        this.voxels[c].corner3.updateLabel(this.camera);
        this.voxels[c].corner4.updateLabel(this.camera);
        this.voxels[c].corner5.updateLabel(this.camera);
        this.voxels[c].corner6.updateLabel(this.camera);
        this.voxels[c].corner7.updateLabel(this.camera);
      }
      else
      {
        this.voxels[c].corner0.clearLabel();
        this.voxels[c].corner1.clearLabel();
        this.voxels[c].corner2.clearLabel();
        this.voxels[c].corner3.clearLabel();
        this.voxels[c].corner4.clearLabel();
        this.voxels[c].corner5.clearLabel();
        this.voxels[c].corner6.clearLabel();
        this.voxels[c].corner7.clearLabel();
      }
    }
    this.updateMesh();
  }

  pause()
  {
    this.isPaused = true;
  }

  play()
  {
    this.isPaused = false;
  }

  show()
  {
    for (var i = 0; i < this.res3; i++)
    {
      this.voxels[i].show();
    }
    this.showGrid = true;
  };

  hide()
  {
    for (var i = 0; i < this.res3; i++)
    {
      this.voxels[i].hide();
    }
    this.showGrid = false;
  };

  makeMesh()
  {
    //create a mesh for every voxel
    //then just update the vertex positions in the updateMesh function
    //this way you don't have to keep re-allocating and de-allocating memory.

    // for (var c = 0; c < this.res3; c++)
    // {
    //   /*
    //   // this.cellTriangles[c]
    //   // var halfGridCellWidth = this.gridCellWidth / 2.0;
    //   //triangles have arbitrary positions right now
    //   // var triangleVertexPositions = new Float32Array([
    //   //   //Random Triangle 1
    //   //   halfGridCellWidth, halfGridCellWidth,  halfGridCellWidth,
    //   //   halfGridCellWidth, halfGridCellWidth, -halfGridCellWidth,
    //   //   halfGridCellWidth, -halfGridCellWidth, halfGridCellWidth
    //   // ]);
    //   //
    //   // var triangleVertexNormals = new Float32Array([
    //   //   //Random Triangle 1
    //   //   0.0, 0.0, 1.0,
    //   //   0.0, 0.0, 1.0,
    //   //   0.0, 0.0, 1.0,
    //   // ]);
    //   */
    //   var trigeo = new THREE.Geometry();
    //   this.mesh = new THREE.Mesh(trigeo, LAMBERT_BLUE);
    //   this.mesh.geometry.dynamic = true;
    //
    //   //this.voxelTriangleMeshes[c].position.set(this.voxels[c].pos.x, this.voxels[c].pos.y, this.voxels[c].pos.z);
    //
    //   this.scene.add(this.mesh);
    // }

    var trigeo = new THREE.Geometry();
    this.mesh = new THREE.Mesh(trigeo, LAMBERT_BLUE);
    this.mesh.geometry.dynamic = true;

    this.scene.add(this.mesh);
  }

  updateMesh()
  {
    //now that all the triangles exist as a mesh, update them every frame via this function
    this.vertexPos = [];
    this.vertexNor = [];

    for (var c = 0; c < this.res3; c++)
    {
      var VertexData = this.voxels[c].polygonize(this.isolevel);
      this.vertexPos.push(VertexData.vertPositions);
      this.vertexNor.push(VertexData.vertNormals);
      // console.log("vertexData");
      // console.log(this.vertexData[c]);

      //var trigeo = new THREE.BufferGeometry();
      //trigeo.addAttribute( 'position', new THREE.BufferAttribute( this.vertexData[c].vertPositions, 3 ) );
      //trigeo.addAttribute( 'normal', new THREE.BufferAttribute( this.vertexData[c].vertNormals, 3 ) );
      //this.voxelTriangleMeshes[c].geometry = trigeo;

      // this.voxelTriangleMeshes[c].geometry.verticesNeedUpdate = true;
      // this.voxelTriangleMeshes[c].geometry.vertices = this.vertexData[c].vertPositions;
      // this.voxelTriangleMeshes[c].geometry.normals = this.vertexData[c].vertNormals;
      // this.voxelTriangleMeshes[c].position.set(this.voxels[c].pos.x, this.voxels[c].pos.y, this.voxels[c].pos.z);
    }

    var geo = this.mesh.geometry;
    geo.vertices = [
      new THREE.Vector3(0,0,0),
      new THREE.Vector3(10,10,10),
      new THREE.Vector3(10*Math.random(),0,0),
    ];
    geo.faces = [
      new THREE.Face3(0, 1, 2, new THREE.Vector3(1,0,0))
    ];

    geo.computeFaceNormals();
    geo.computeVertexNormals();

    // debugger;

    geo.verticesNeedUpdate = true;
    geo.elementsNeedUpdate = true;
  }
};

// ------------------------------------------- //

class Voxel
{
  constructor(position, gridCellWidth)
  {
    this.init(position, gridCellWidth);
  }

  init(position, gridCellWidth)
  {
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

  makeInspectPoints()
  {
    var halfGridCellWidth = this.gridCellWidth / 2.0;
    var x = this.pos.x;
    var y = this.pos.y;
    var z = this.pos.z;
    var red = 0xff0000;

    // Center dot
    this.center = new InspectPoint(new THREE.Vector3(x, y, z), 0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);

    //Paul Brooke's vertex indexing scheme
    this.corner0 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner1 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner2 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner3 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner4 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner5 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner6 = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner7 = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
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

  vertexInterpolation(isolevel, vertA, vertB)
  {
    var lerpPos = new THREE.Vector3(0.0, 0.0, 0.0);
    var interpolatedIsolevel = (isolevel - vertA.isovalue)/(vertB.isovalue - vertA.isovalue);

    if ( Math.abs(isolevel - vertA.isolevel) < 0.00001 )
    {
      lerpPos.x = VertA.pos.x;
      lerpPos.y = VertA.pos.y;
      lerpPos.z = VertA.pos.z;
      return lerpPos;
    }
    if ( Math.abs(isolevel - vertB.isolevel) < 0.00001 )
    {
      lerpPos.x = VertB.pos.x;
      lerpPos.y = VertB.pos.y;
      lerpPos.z = VertB.pos.z;
      return lerpPos;
    }
    if ( Math.abs(vertA.isolevel - vertB.isolevel) < 0.00001 )
    {
      lerpPos.x = VertA.pos.x;
      lerpPos.y = VertA.pos.y;
      lerpPos.z = VertA.pos.z;
      return lerpPos;
    }

    lerpPos.x = vertA.pos.x + interpolatedIsolevel*(vertB.pos.x - vertA.pos.x);
    lerpPos.y = vertA.pos.y + interpolatedIsolevel*(vertB.pos.y - vertA.pos.y);
    lerpPos.z = vertA.pos.z + interpolatedIsolevel*(vertB.pos.z - vertA.pos.z);
    return lerpPos;
  }

  normalInterpolation(isolevel, vertA, vertB)
  {
    var lerpNor = new THREE.Vector3(0.0, 0.0, 1.0);
    var interpolatedIsolevel = (isolevel - vertA.isovalue)/(vertB.isovalue - vertA.isovalue);

    if ( Math.abs(isolevel - vertA.isolevel) < 0.00001 )
    {
      lerpNor.x = VertA.isonormal.x;
      lerpNor.y = VertA.isonormal.y;
      lerpNor.z = VertA.isonormal.z;
      return lerpNor;
    }
    if ( Math.abs(isolevel - vertB.isolevel) < 0.00001 )
    {
      lerpNor.x = VertB.isonormal.x;
      lerpNor.y = VertB.isonormal.y;
      lerpNor.z = VertB.isonormal.z;
      return lerpNor;
    }
    if ( Math.abs(vertA.isolevel - vertB.isolevel) < 0.00001 )
    {
      lerpNor.x = VertA.isonormal.x;
      lerpNor.y = VertA.isonormal.y;
      lerpNor.z = VertA.isonormal.z;
      return lerpNor;
    }

    lerpNor.x = vertA.isonormal.x + interpolatedIsolevel*(vertB.isonormal.x - vertA.isonormal.x);
    lerpNor.y = vertA.isonormal.y + interpolatedIsolevel*(vertB.isonormal.y - vertA.isonormal.y);
    lerpNor.z = vertA.isonormal.z + interpolatedIsolevel*(vertB.isonormal.z - vertA.isonormal.z);
    return lerpNor;
  }

  polygonize(isolevel) //called by a voxel
  {
    var vertexList = [];
    var normalList = [];

    var cubeindex = 0;
    if (this.corner0.isovalue > isolevel) cubeindex |= 1;
    if (this.corner1.isovalue > isolevel) cubeindex |= 2;
    if (this.corner2.isovalue > isolevel) cubeindex |= 4;
    if (this.corner3.isovalue > isolevel) cubeindex |= 8;
    if (this.corner4.isovalue > isolevel) cubeindex |= 16;
    if (this.corner5.isovalue > isolevel) cubeindex |= 32;
    if (this.corner6.isovalue > isolevel) cubeindex |= 64;
    if (this.corner7.isovalue > isolevel) cubeindex |= 128;

    var edges = LUT.EDGE_TABLE[cubeindex]; // retruns a 12 bit number as a
                                          // sort of bit switch for the edges
                                          // which are being intersected

    //Voxel is entirely in/out of the surface od the metaball
    if (edges == 0)
    {
      return(0);
    }

    //Find the vertices(on the edges) where the metaball intersects the voxel
    var lerpedEdgePoints = new Array(12);
    var lerpedEdgeNormals = new Array(12);

    if (edges & 1)
    {
      lerpedEdgePoints[0] = this.vertexInterpolation(isolevel, this.corner0, this.corner1);
      lerpedEdgeNormals[0] = this.normalInterpolation(isolevel, this.corner0, this.corner1);
    }
    if (edges & 2)
    {
      lerpedEdgePoints[1] = this.vertexInterpolation(isolevel, this.corner1, this.corner2);
      lerpedEdgeNormals[1] = this.normalInterpolation(isolevel, this.corner1, this.corner2);
    }
    if (edges & 4)
    {
      lerpedEdgePoints[2] = this.vertexInterpolation(isolevel, this.corner2, this.corner3);
      lerpedEdgeNormals[2] = this.normalInterpolation(isolevel, this.corner2, this.corner3);
    }
    if (edges & 8)
    {
      lerpedEdgePoints[3] = this.vertexInterpolation(isolevel, this.corner3, this.corner0);
      lerpedEdgeNormals[3] = this.normalInterpolation(isolevel, this.corner3, this.corner0);
    }
    if (edges & 16)
    {
      lerpedEdgePoints[4] = this.vertexInterpolation(isolevel, this.corner4, this.corner5);
      lerpedEdgeNormals[4] = this.normalInterpolation(isolevel, this.corner4, this.corner5);
    }
    if (edges & 32)
    {
      lerpedEdgePoints[5] = this.vertexInterpolation(isolevel, this.corner5, this.corner6);
      lerpedEdgeNormals[5] = this.normalInterpolation(isolevel, this.corner5, this.corner6);
    }
    if (edges & 64)
    {
      lerpedEdgePoints[6] = this.vertexInterpolation(isolevel, this.corner6, this.corner7);
      lerpedEdgeNormals[6] = this.normalInterpolation(isolevel, this.corner6, this.corner7);
    }
    if (edges & 128)
    {
      lerpedEdgePoints[7] = this.vertexInterpolation(isolevel, this.corner7, this.corner4);
      lerpedEdgeNormals[7] = this.normalInterpolation(isolevel, this.corner7, this.corner4);
    }
    if (edges & 256)
    {
      lerpedEdgePoints[8] = this.vertexInterpolation(isolevel, this.corner0, this.corner4);
      lerpedEdgeNormals[8] = this.normalInterpolation(isolevel, this.corner0, this.corner4);
    }
    if (edges & 512)
    {
      lerpedEdgePoints[9] = this.vertexInterpolation(isolevel, this.corner1, this.corner5);
      lerpedEdgeNormals[9] = this.normalInterpolation(isolevel, this.corner1, this.corner5);
    }
    if (edges & 1024)
    {
      lerpedEdgePoints[10] = this.vertexInterpolation(isolevel, this.corner2, this.corner6);
      lerpedEdgeNormals[10] = this.normalInterpolation(isolevel, this.corner2, this.corner6);
    }
    if (edges & 2048)
    {
      lerpedEdgePoints[11] = this.vertexInterpolation(isolevel, this.corner3, this.corner7);
      lerpedEdgeNormals[11] = this.normalInterpolation(isolevel, this.corner3, this.corner7);
    }

    //Create the triangle(s) (upto 5 triangles) andstore those vertices into the vertexList

    //for loop stops at -1 because we've made the last int stored in every row of the in the TRI_TABLE == -1
    //the other values can be up to 15 vertices for the triangles

    var index = cubeindex;
    for(var i = index; LUT.TRI_TABLE[i]!=-1; i=i+3)
    {
      // console.log("inside for loop");
      // console.log(LUT.TRI_TABLE[i]);
      // console.log(LUT.TRI_TABLE[i+1]);
      // console.log(LUT.TRI_TABLE[i+2]);

      vertexList.push(lerpedEdgePoints[LUT.TRI_TABLE[i]]);
      vertexList.push(lerpedEdgePoints[LUT.TRI_TABLE[i+1]]);
      vertexList.push(lerpedEdgePoints[LUT.TRI_TABLE[i+2]]);

      normalList.push(lerpedEdgeNormals[LUT.TRI_TABLE[i]]);
      normalList.push(lerpedEdgeNormals[LUT.TRI_TABLE[i+1]]);
      normalList.push(lerpedEdgeNormals[LUT.TRI_TABLE[i+2]]);
    }

    // console.log("vertexList");
    // console.log(vertexList.length);
    // console.log(normalList.length);

    return {
      vertPositions: vertexList,
      vertNormals: normalList
    };
  }
}
