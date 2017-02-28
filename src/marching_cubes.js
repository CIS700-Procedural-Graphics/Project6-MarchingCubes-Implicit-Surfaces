const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';

import {iriMaterial} from './main.js';

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
    // @TODO
    var isovalue=0;// = 1.1;

    for(var i=0; i<this.numMetaballs; i++)
    {
        var r = this.balls[i].radius;
        var d = Math.max(point.distanceTo(this.balls[i].pos),0.00001);
        isovalue += r*r/d/d;
        //debugger;
    }

    //debugger;
    //console.log(isovalue);
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
      //this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);

      // @CHANGED - start
      // Sampling the vertices
      for(var i=0; i<8; i++)
      {
          this.voxels[c].vertices[i].isovalue = this.sample(this.voxels[c].vertices[i].pos);
      }
      //debugger;
      // @CHANGED - end

      // Visualizing grid
    //   for(var c=0; c < this.res3; c++)
    //   {
    //     for(var i=0; i<8; i++)
    //     {
            if (VISUAL_DEBUG && this.showGrid) {
                // Toggle voxels on or off
                if (this.voxels[c].center.isovalue > this.isolevel) {
                  this.voxels[c].show();
                }
                else {
                  this.voxels[c].hide();
                }
                this.voxels[c].center.updateLabel(this.camera);
            }
            else {
                this.voxels[c].center.clearLabel();
            }
    //     }
    //   }
    //   if (VISUAL_DEBUG && this.showGrid) {
      //
    //     // Toggle voxels on or off
    //     if (this.voxels[c].center.isovalue > this.isolevel) {
    //       this.voxels[c].show();
    //     } else {
    //       this.voxels[c].hide();
    //     }
    //     this.voxels[c].center.updateLabel(this.camera);
    //   } else {
    //     this.voxels[c].center.clearLabel();
    //   }
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
    // geo = new THREE.BufferGeometry(this.gridCellWidth, this.gridCellWidth, this.gridCellWidth);
    // this.mesh = new THREE.Mesh( geo, LAMBERT_GREEN );
    // this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    //debugger;
    var geometry = new THREE.Geometry();
    this.outmesh = new THREE.Mesh( geometry, iriMaterial );
    this.outmesh.material.side = THREE.DoubleSide;
    this.scene.add(this.outmesh);
    // for (var c = 0; c < this.res3; c++)
    // {
    //     var polyret = this.voxels[c].polygonize(1);
    //     //var ntriang=0;
    //
    //     for (var i=0; LUT.TRI_TABLE[polyret.cubeIndex*16+i]!=-1 && polyret!=0; i+=3)
    //     {
    //         // triangles[ntriang].p[0] = polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i]];
    //         // triangles[ntriang].p[1] = polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i+1]];
    //         // triangles[ntriang].p[2] = polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i+2]];
    //         // ntriang++;
    //
    //         // geometry.vertices.push(
    //         // 	polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i]],
    //         // 	polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i+1]],
    //         // 	polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i+2]]
    //         // );
    //         // geometry.faces.push( new THREE.Face3( i+0, i+1, i+2 ) );
    //
    //         // console.log(geometry.faces);
    //         // debugger;
    //         //debugger;
    //         //geometry.computeBoundingSphere();
    //         //this.scene.add(mesh);
    //
    //         // var geometry = new THREE.Geometry();
    //         // var mesh = new THREE.Mesh( geometry, LAMBERT_WHITE );
    //         // geometry.vertices.push(
    //         // 	new THREE.Vector3( -10,  10, 0 ),
    //         // 	new THREE.Vector3( -10, -10, 0 ),
    //         // 	new THREE.Vector3(  10, -10, 0 )
    //         // );
    //         //
    //         // geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );
    //         // geometry.computeBoundingSphere();
    //     }
    // }


  }

  updateMesh() {
    // @TODO
    //this.scene.clear();
    var geometry = new THREE.Geometry();
    //var mesh = new THREE.Mesh( geometry, LAMBERT_WHITE );
    var v=0;
    for (var c = 0; c < this.res3; c++)
    {
        var polyret = this.voxels[c].polygonize(0.5);
        for (var i=0; LUT.TRI_TABLE[polyret.cubeIndex*16+i]!=-1 && polyret!=0; i+=3)
        {
            var norm = [];
            var vert1 = new THREE.Vector3(0,0,0);
            norm[0] = new THREE.Vector3(0,0,0);
            vert1.copy(polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i]]);
            norm[0].copy(this.calcNorm(vert1));

            var vert2 = new THREE.Vector3(0,0,0);
            norm[1] = new THREE.Vector3(0,0,0);
            vert2.copy(polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i+1]]);
            norm[1].copy(this.calcNorm(vert2));

            var vert3 = new THREE.Vector3(0,0,0);
            norm[2] = new THREE.Vector3(0,0,0);
            vert3.copy(polyret.vertPositions[LUT.TRI_TABLE[polyret.cubeIndex*16+i+2]]);
            norm[2].copy(this.calcNorm(vert3));

            geometry.vertices.push(vert1, vert2, vert3);

            geometry.faces.push( new THREE.Face3( v, v+1, v+2 , norm ) );
            v+=3;
            //debugger;
            // geometry.computeBoundingSphere();
            // geometry.computeFaceNormals();

        }
    }
    //debugger;
    this.outmesh.geometry=geometry;
    //this.scene.add(this.mesh);
  }

  calcNorm(vert)
  {
      var eps = 0.01;
      var norm = new THREE.Vector3(0,0,0);
      norm.x = this.sample(new THREE.Vector3(vert.x+eps,vert.y,vert.z)) - this.sample(new THREE.Vector3(vert.x-eps,vert.y,vert.z));
      norm.y = this.sample(new THREE.Vector3(vert.x,vert.y+eps,vert.z)) - this.sample(new THREE.Vector3(vert.x,vert.y-eps,vert.z));
      norm.z = this.sample(new THREE.Vector3(vert.x,vert.y,vert.z+eps)) - this.sample(new THREE.Vector3(vert.x,vert.y,vert.z-eps));
      norm = norm.normalize();
    //   if(norm.dot(new THREE.Vector3(0,0,1))<0)
    //     {
    //         norm.x=-norm.x;
    //         norm.y=-norm.y;
    //         norm.z=-norm.z;
    //     }
      return norm;
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

    // @CHANGED - start
    var positions = [
      // Front face
       [halfGridCellWidth, halfGridCellWidth,  halfGridCellWidth],
       [halfGridCellWidth, -halfGridCellWidth, halfGridCellWidth],
      [-halfGridCellWidth, -halfGridCellWidth, halfGridCellWidth],
      [-halfGridCellWidth, halfGridCellWidth,  halfGridCellWidth],

      // Back face
      [-halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth],
      [-halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth],
       [halfGridCellWidth, -halfGridCellWidth, -halfGridCellWidth],
       [halfGridCellWidth,  halfGridCellWidth, -halfGridCellWidth],
    ];

    // Vertices
    this.vertices = [];
    for(var i=0; i<8; i++)
    {
        var x = this.pos.x + positions[i][0];
        var y = this.pos.y + positions[i][1];
        var z = this.pos.z + positions[i][2];
        this.vertices[i] =  new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
    }
    //debugger;
    // @CHANGED - end
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

    // @TODO
    var lerpPos = new THREE.Vector3(0,0,0);
    var p1 = new THREE.Vector3(0,0,0);
    p1.x = posA.pos.x; p1.y = posA.pos.y; p1.z = posA.pos.z;
    var p2 = new THREE.Vector3(0,0,0);
    p2.x = posB.pos.x; p2.y = posB.pos.y; p2.z = posB.pos.z;
    var val1 = 0;
    val1 = posA.isovalue;
    var val2 = 0;
    val2 = posB.isovalue;

    if(this.less(posB.pos,posA.pos))
    {
        p1.x = posB.pos.x; p1.y = posB.pos.y; p1.z = posB.pos.z;
        p2.x = posA.pos.x; p2.y = posA.pos.y; p2.z = posA.pos.z;

        val1 = posB.isovalue;
        val2 = posA.isovalue;
    }

    if(Math.abs(val1-val2)>0.00001)
    {
        lerpPos.x = p1.x + (p2.x-p1.x)/(val2-val1)*(isolevel-val1);
        lerpPos.y = p1.y + (p2.y-p1.y)/(val2-val1)*(isolevel-val1);
        lerpPos.z = p1.z + (p2.z-p1.z)/(val2-val1)*(isolevel-val1);
    }
    else
    {
        lerpPos.x = p1.x;
        lerpPos.y = p1.y;
        lerpPos.z = p1.z;
    }

   //  if (Math.abs(isolevel-posA.isovalue) < 0.00001)
   //    return(posA.pos);
   //  if (Math.abs(isolevel-posB.isovalue) < 0.00001)
   //    return(posB.pos);
   //  if (Math.abs(posA.isovalue - posB.isovalue) < 0.00001)
   //    return(posA.pos);
   //
   // var mu = (isolevel - posA.isovalue)/(posB.isovalue - posA.isovalue);
   // lerpPos.x = (1-mu)*posA.pos.x + mu*posB.pos.x;
   // lerpPos.y = (1-mu)*posA.pos.y + mu*posB.pos.y;
   // lerpPos.z = (1-mu)*posA.pos.z + mu*posB.pos.z;

    //debugger;
    return lerpPos;
  }

  less(A,B){
        if (A.x < B.x)
            return true;
        else if (A.x > B.x)
            return false;

        if (A.y < B.y)
            return true;
        else if (A.y > B.y)
            return false;

        if (A.z < B.z)
            return true;
        else if (A.z > B.z)
            return false;

        return false;
  }

  polygonize(isolevel) {

    // @TODO
    var vertexList = [];
    var normalList = [];

    var grid = this.vertices;
    var cubeindex=0;

    // Determine the index into the edge table which
    // tells us which vertices are inside of the surface

    if (grid[0].isovalue > isolevel) cubeindex |= 1;
    if (grid[1].isovalue > isolevel) cubeindex |= 2;
    if (grid[2].isovalue > isolevel) cubeindex |= 4;
    if (grid[3].isovalue > isolevel) cubeindex |= 8;
    if (grid[4].isovalue > isolevel) cubeindex |= 16;
    if (grid[5].isovalue > isolevel) cubeindex |= 32;
    if (grid[6].isovalue > isolevel) cubeindex |= 64;
    if (grid[7].isovalue > isolevel) cubeindex |= 128;

    // if (grid[0].isovalue < isolevel) cubeindex |= 1;
    // if (grid[1].isovalue < isolevel) cubeindex |= 2;
    // if (grid[2].isovalue < isolevel) cubeindex |= 4;
    // if (grid[3].isovalue < isolevel) cubeindex |= 8;
    // if (grid[4].isovalue < isolevel) cubeindex |= 16;
    // if (grid[5].isovalue < isolevel) cubeindex |= 32;
    // if (grid[6].isovalue < isolevel) cubeindex |= 64;
    // if (grid[7].isovalue < isolevel) cubeindex |= 128;

    // Cube is entirely in/out of the surface
    if (LUT.EDGE_TABLE[cubeindex] == 0) return(0);
    //debugger;

    // Find the vertices where the surface intersects the cube
    if (LUT.EDGE_TABLE[cubeindex] & 1)
    {
        //vertexList[0] = new THREE.Vector3(0,0,0);
        vertexList[0] = this.vertexInterpolation(isolevel,grid[0],grid[1]);
        //console.log(vertexList[0]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 2)
    {
        //vertexList[1] = new THREE.Vector3(0,0,0);
        vertexList[1] = this.vertexInterpolation(isolevel,grid[1],grid[2]);
        //console.log(vertexList[1]);
        //console.log(temp);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 4)
    {
        //vertexList[2] = new THREE.Vector3(0,0,0);
        vertexList[2] = this.vertexInterpolation(isolevel,grid[2],grid[3]);
        //console.log(vertexList[2]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 8)
    {
        //vertexList[3] = new THREE.Vector3(0,0,0);
        vertexList[3] = this.vertexInterpolation(isolevel,grid[3],grid[0]);
        //console.log(vertexList[3]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 16)
    {
        //vertexList[4] = new THREE.Vector3(0,0,0);
        vertexList[4] = this.vertexInterpolation(isolevel,grid[4],grid[5]);
        //console.log(vertexList[4]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 32)
    {
        //vertexList[5] = new THREE.Vector3(0,0,0);
        vertexList[5] = this.vertexInterpolation(isolevel,grid[5],grid[6]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 64)
    {
        //vertexList[6] = new THREE.Vector3(0,0,0);
        vertexList[6] = this.vertexInterpolation(isolevel,grid[6],grid[7]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 128)
    {
        //vertexList[7] = new THREE.Vector3(0,0,0);
        vertexList[7] = this.vertexInterpolation(isolevel,grid[7],grid[4]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 256)
    {
        //vertexList[8] = new THREE.Vector3(0,0,0);
        vertexList[8] = this.vertexInterpolation(isolevel,grid[0],grid[4]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 512)
    {
        //vertexList[9] = new THREE.Vector3(0,0,0);
        vertexList[9] = this.vertexInterpolation(isolevel,grid[1],grid[5]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 1024)
    {
        //vertexList[10] = new THREE.Vector3(0,0,0);
        vertexList[10] = this.vertexInterpolation(isolevel,grid[2],grid[6]);
    }
    if (LUT.EDGE_TABLE[cubeindex] & 2048)
    {
        //vertexList[11] = new THREE.Vector3(0,0,0);
        vertexList[11] = this.vertexInterpolation(isolevel,grid[3],grid[7]);
    }

    //console.log(vertexList[3]);
    // var ntriang=0;
    // for (var i=0; LUT.TRI_TABLE[cubeindex*16+i]!=-1; i+=3)
    // {
    //     triangles[ntriang].p[0] = vertexList[LUT.TRI_TABLE[cubeindex*16+i]];
    //     triangles[ntriang].p[1] = vertexList[LUT.TRI_TABLE[cubeindex*16+i+1]];
    //     triangles[ntriang].p[2] = vertexList[LUT.TRI_TABLE[cubeindex*16+i+2]];
    //     ntriang++;
    // }
    // for(var i=0; i<12; i++)
    // {
    //     //console.log(vertexList[i]);
    //     if(vertexList[i]===undefined)
    //         debugger;
    // }



    //debugger;
    return {
      vertPositions: vertexList,//vertPositions,
      //vertNormals: normalList,//vertNormals
      cubeIndex: cubeindex
    };
  };
}
