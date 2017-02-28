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

    // -HB : added to calc samples at corners
    this.calcAllVoxelSamples();

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

  // -HB
  // performed for each voxel
  calcAllVoxelSamples() {
    /********************************************************************************************************/
    // In order to polygonize a voxel, generate new samples at each corner of the voxel. Their isovalues must
    // be updated as the metaball function changes due of metaballs moving.
    /********************************************************************************************************/

    for (var i = 0; i < this.voxels.length; i++) {
      var c = new THREE.Vector3(0.0, 0.0, 0.0);
      c = this.voxels[i].pos;
      var hW = this.gridCellWidth / 2.0;

      var allPoints = new Array();

      var cx = c.x;
      var cy = c.y;
      var cz = c.z;
      allPoints.push( new THREE.Vector3(cx-hW, cy-hW, cz+hW), // bottom face: 0, 1, 2, 3
                      new THREE.Vector3(cx+hW, cy-hW, cz+hW),
                      new THREE.Vector3(cx+hW, cy-hW, cz-hW),
                      new THREE.Vector3(cx-hW, cy-hW, cz-hW),
                      new THREE.Vector3(cx-hW, cy+hW, cz+hW), // top face: 4, 5, 6, 7
                      new THREE.Vector3(cx+hW, cy+hW, cz+hW),
                      new THREE.Vector3(cx+hW, cy+hW, cz-hW),
                      new THREE.Vector3(cx-hW, cy+hW, cz-hW));

      var samp = new Array();

      for (var j = 0; j < allPoints.length; j++) {
        samp.push(this.sample(allPoints[j]));
      }

      this.voxels[i].samples = samp;
    }
  }

  // This function samples a point from the metaball's density function
  // Implement a function that returns the value of the all metaballs influence to a given point.
  // Please follow the resources given in the write-up for details.
  sample(point) {
    // f(pointInfluence) = (r^2)/d^2;

    var isoVal = 0.0;
    for (var i = 0; i < this.numMetaballs; i++) {
      var ball = this.balls[i];

      var xD = ball.pos.x - point.x;
      var yD = ball.pos.y - point.y;
      var zD = ball.pos.z - point.z;

      var dist = Math.sqrt(xD * xD + yD * yD + zD * zD);
      var rad = ball.radius;
      isoVal += (rad * rad) / (dist * dist);
    }

    // note: sum must be > 1.0 to show up
    return isoVal;
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

    // -HB : added to calc samples at corners
    this.calcAllVoxelSamples();
    console.log("calculated all voxel samples");
    this.updateMesh();
    console.log("updated mesh based on polygonized values");
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
  }

  updateMesh() {
    // for each voxel - call polygonize(this.isolevel);
    // update their vertex positions and normals?
    // use normals for coloring the mesh based on material

    for (var i = 0; i < this.voxels.length; i++){
      // positions, normals = voxels[i].polygonize(this.isolevel);

      var currVoxel = this.voxels[i];
      var obj = currVoxel.polygonize(this.isolevel);
      
      var updatedPositions = obj.vertPositions;
      var updatedNormals = obj.vertNormals;

      //var geo = new THREE.BufferGeometry();
      //geo.setIndex( new THREE.BufferAttribute( indices, 1 ) );
      //geo.addAttribute( 'position', new THREE.BufferAttribute( updatedPositions, 3 ) );

      var geo = currVoxel.mesh.geometry;
      geo.vertices = updatedPositions;
      geo.faces = new Array();

      for (var j =0; j < updatedNormals.length; j += 3) {
        var face = new THREE.Face3(j, j+1, j+2, new THREE.Vector3(0.0, 0.0, 1.0), 0xff0000, 0);
        face.vertexNormals[0] = updatedNormals[j];
        face.vertexNormals[1] = updatedNormals[j+1];
        face.vertexNormals[2] = updatedNormals[j+2];
        geo.faces.push(face);
      }

      // update for new geometry
      geo.verticesNeedUpdate = true;
      geo.dynamic = true;
      geo.elementsNeedUpdate = true;
    }

    // note: since geo is updated - green mesh and white wireframe should both update.
  }  
};

// ------------------------------------------- //

// -HB: defining type for normals and polygonization
function vertexHolder() {
    this.loc = new THREE.Vector3(0.0, 0.0, 0.0); // curr vertex
    this.touchingFaces = new Array(); // listing of touching faces
    this.numFaces = 0;

    this.addItem = function(item) {
      this.touchingFaces.push(item);
      this.numFaces += 1;
    }
}

function allVerticesHolder() {
    this.allVertexHolders = new Array(); // listing of touching faces
    this.numVertices = 0;

    this.addVertexHolder = function(item) {
      this.allVertexHolders.push(item);
      this.numVertices += 1;
    }

    this.addFaceToVertex = function(face, vertex) {
      // face is a Vector3f of Vector3f
      // vertex is a Vector3f
      var added = false;
      for (var i = 0; i < this.numVertices; i++) {
        var loc = this.allVertexHolders[i].loc;
        if (loc.x == vertex.x && loc.y == vertex.y && loc.z == vertex.z) {
          this.allVertexHolders[i].addItem(face);
          added = true;
        }
      }

      if (!added) {
        var vH = new vertexHolder();
        vH.addItem(face);
        vH.loc = vertex;

        this.numVertices += 1;
        this.allVertexHolders.push(vH);
      }
    }

    this.getAssociatedFaces = function(vertex) {
      var margin = .05;
      for (var i = 0; i < this.numVertices; i++) {
        var loc = this.allVertexHolders[i].loc;
        
        if (Math.abs(loc.x - vertex.x) < margin && Math.abs(loc.y - vertex.y) < margin && Math.abs(loc.z - vertex.z) < margin) {
          return this.allVertexHolders[i].touchingFaces;
        }
      }

      console.log("MISSING ASSOCIATED FACES FOR A VERTEX");
      return;
    }
}

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

    //-HB: added to be the sample value at each corner
    // to initialize: filling with 8 items so array.length is 8
    this.samples = new Array();
    for (var i = 0; i < 8; i++) {
      this.samples.push(0.0);
    } 
    // ^ samples is filled with approp values in update in MarchingCubes  
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

  // -HB : for lerping
  vertexInterpolation(isolevel, posA, posB, ip1, ip2) {
    /********************************************************************************************************/
    // compute the linearly interpolated vertex position on the edge according to the isovalue at each
    // end corner of the edge.
    /********************************************************************************************************/
    var checkWith = 0.00001;

    // just p1
    if (Math.abs(isolevel - ip1) < checkWith) {
      return posA;
    }
    // just p2
    if (Math.abs(isolevel - ip2) < checkWith) {
      return posB;
    }
    // based on diff between isovals of the points, if too close then just return one of them
    // bc almost as if the same
    if (Math.abs(ip1 - ip2) < checkWith) {
      return posA;
    }

    var p = new THREE.Vector3(0.0, 0.0, 0.0);
    var weight = (isolevel - ip1) / (ip2 - ip1);
    p.x = posA.x + weight * (posB.x - posA.x);
    p.y = posA.y + weight * (posB.y - posA.y);
    p.z = posA.z + weight * (posB.z - posA.z);

    return p;
  }


  //  http://paulbourke.net/geometry/polygonise/
  polygonize(isoLevel) {
    /********************************************************************************************************/
    // compute the vertex positions based on intersected edges and isovals. from these created polygons
    // compute the associated normals as well.
    /********************************************************************************************************/

    // stores list of vertices but not in triangle format
    var vertexLocations = [];
    // stores list of normals but again not in triangle format
    var normalVals = [];
    // array to hold listing of vertex to attached faces to later find weighting of associated 
    //    faces based on inverse of their areas
    var verticesHolder = new allVerticesHolder();

    // figure out cell configuration based isoVals versus isoLevel
    var pickCube = 0;
    for (var i = 0; i < 8; i++) {
      if (this.samples[i] > isoLevel) {
        pickCube += Math.pow(2, i);
      }
    }

    var vertPositions = []; //to be returned
    var vertNormals = []; //to be returned

    // finding vertices where cube intersects
    // if cube index is 0 then no vertices returned [cube entirely in/out of the visual area so not shown]
    if (pickCube == 0) {
      return {
        vertPositions: vertPositions,
        vertNormals: vertNormals
      };
    }

    // GIVEN POSITIONS
    var c = new THREE.Vector3(0.0, 0.0, 0.0);
    c = this.pos;
    var hW = this.gridCellWidth / 2.0;

    var allPoints = new Array();

    var cx = c.x;
    var cy = c.y;
    var cz = c.z;
    allPoints.push( new THREE.Vector3(cx-hW, cy-hW, cz+hW), // bottom face: 0, 1, 2, 3
                    new THREE.Vector3(cx+hW, cy-hW, cz+hW),
                    new THREE.Vector3(cx+hW, cy-hW, cz-hW),
                    new THREE.Vector3(cx-hW, cy-hW, cz-hW),
                    new THREE.Vector3(cx-hW, cy+hW, cz+hW), // top face: 4, 5, 6, 7
                    new THREE.Vector3(cx+hW, cy+hW, cz+hW),
                    new THREE.Vector3(cx+hW, cy+hW, cz-hW),
                    new THREE.Vector3(cx-hW, cy+hW, cz-hW));

    var indexLocs = [
      0, 1, 1, 2, 
      2, 3, 3, 0, 
      4, 5, 5, 6,  
      6, 7, 7, 4,
      0, 4, 1, 5,
      2, 6, 3, 7 ];

    // i goes from [0, 11] bc going through all poss bits
    var twelveBits = LUT.EDGE_TABLE[pickCube];

    var j = 0;
    for (var i = 0; i < 12; i++) {
      if (twelveBits & Math.pow(2, i)) {
        var i_curr = indexLocs[j];
        var i_next = indexLocs[j+1];

        // console.log(isoLevel);
        // console.log("idx curr : " + i_curr);
        // console.log("idx next : " + i_next);
        // console.log("allPoints[idx]: " + allPoints[i_curr] + ", allPoints[idx+1]" + allPoints[i_next] );
        // console.log("this.samples[idx]: " + this.samples[i_curr] + ", this.samples[idx + 1]" + this.samples[i_next] );
        vertexLocations[i] = this.vertexInterpolation(isoLevel,
                                                      allPoints[i_curr],
                                                      allPoints[i_next],
                                                      this.samples[i_curr],
                                                      this.samples[i_next]);
      }

      j += 2;
    }//end: forLoop over 12bits

    // now have vertex locations for all edge intersections - ie what our final geo will be built with
    // need to make triangles out of these now
    // var currTri = 0;
    // iterate through the current tri_table row and fill out triangles until you reach -1 which means there are no longer
    //    triangles to be filled for this orientation
    // gets which vertex nums are used for this triangle based on tri table but uses vertex locations for actual positions of 
    //    intersection location for the triangles that are created
    // also filling in vertexPositions appropriately
    // console.log("pickCube: " + pickCube);
    for (var i = 0; LUT.TRI_TABLE[pickCube * 16 + i] != -1; /*i += 3*/) {
      var loc1 = vertexLocations[LUT.TRI_TABLE[pickCube * 16 + i]];
      var loc2 = vertexLocations[LUT.TRI_TABLE[pickCube * 16 + i+1]];
      var loc3 = vertexLocations[LUT.TRI_TABLE[pickCube * 16 + i+2]];
      var currFace = new THREE.Vector3(loc1, loc2, loc3);
      vertPositions.push(loc1);
      vertPositions.push(loc2);
      vertPositions.push(loc3);

      // now matching vertices with additional faces
      verticesHolder.addFaceToVertex(currFace, loc1);
      verticesHolder.addFaceToVertex(currFace, loc2);
      verticesHolder.addFaceToVertex(currFace, loc3);

      i += 3;
      // currTri += 1;
    }

    // calculating normals
    // for each vertex - find average of the normals of all attached faces but calculate the overall normal for the point
    //    such that the weighting used for each normals addition to the calculation is based on 1/SA of the associated face
    // since for the assignment not focused on implementation speed
    //    make listing of which vertices touch which faces and just calculate for each vertex then put in
    for (var i = 0; i < vertexLocations.length; i++) {
      // face's normal: (A-B)x(C-B).normalize
      // area of face: based on cross product = length of cross product / 2;

      if (vertexLocations[i] != null) {
        var currNormal = new THREE.Vector3(0.0);
        var faces = verticesHolder.getAssociatedFaces(vertexLocations[i]);

        //current problem: faces being returned as a vec3 and not as a vector of faces

        for (var j = 0; j< faces.length; j++) {
          var A = faces[j].x;
          var B = faces[j].y;
          var C = faces[j].z;

          var aAndb = new THREE.Vector3(A.x-B.x, A.y - B.y, A.z - B.z);
          var cAndb = new THREE.Vector3(C.x-B.x, C.y - B.y, C.z - B.z);
          var crossVal = (aAndb).cross(cAndb);
          var areaOfFace = crossVal.length/2.0;
          var normOfFace = crossVal.normalize();
          currNormal += normOfFace / areaOfFace;
        }

        currNormal.normalize();
        normalVals.push(currNormal);
      }
    }
    
    // filling in vertexNormals appropriately based on which vertices are actually used for which faces
    for (var i = 0; LUT.TRI_TABLE[pickCube * 16 + i] != -1; i += 3) {
      var loc1 = normalVals[LUT.TRI_TABLE[pickCube * 16 + i]];
      var loc2 = normalVals[LUT.TRI_TABLE[pickCube * 16 + i+1]];
      var loc3 = normalVals[LUT.TRI_TABLE[pickCube * 16 + i+2]];
      vertNormals.push(loc1);
      vertNormals.push(loc2);
      vertNormals.push(loc3);
    }

    console.log("UPDATED POSITIONS AND NORMALS");   

    return {
      vertPositions: vertPositions,
      vertNormals: vertNormals
    };
  };
}