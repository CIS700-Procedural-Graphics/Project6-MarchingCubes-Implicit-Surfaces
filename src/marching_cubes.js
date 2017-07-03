const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
var VISUAL_DEBUG = false;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );
const LAMBERT_BLUE = new THREE.MeshLambertMaterial( { color: 0x2194ce, side: THREE.DoubleSide } );

var color_Material = new THREE.ShaderMaterial({
  uniforms: {
    metaball_color:
    {
        type: "v3",
        value: new THREE.Color(0x2194ce)
    },
    lightPos:
    {
        type: "v3",
        value: new THREE.Vector3(1.0, 10.0, 2.0)
    }
  },
  vertexShader: require('./shaders/iridescent-vert.glsl'),
  fragmentShader: require('./shaders/iridescent-frag.glsl')
});

//Made balls[] and numMetaballs global variables to improve efficiency;
//This lets us calculate the normals at the isosurface for that point alone,
//instead of for all the corner points and then having to lerp between the resultant values.
var balls = [];
var numMetaballs;
//the indexLook up is just to avoid a lengthy string of if statements
var indexLookup = [ 0,1,1,2,
                    2,3,3,0,
                    4,5,5,6,
                    6,7,7,4,
                    0,4,1,5,
                    2,6,3,7 ];

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
    this.minRadius = App.config.minRadius; //of metaballs
    this.maxRadius = App.config.maxRadius; //of metaballs

    this.gridCellWidth = App.config.gridCellWidth;
    this.halfCellWidth = App.config.gridCellWidth / 2.0;
    this.gridWidth = App.config.gridWidth;

    this.res = App.config.gridRes;
    this.res2 = App.config.gridRes * App.config.gridRes;
    this.res3 = App.config.gridRes * App.config.gridRes * App.config.gridRes;

    this.maxSpeed = App.config.maxSpeed;
    numMetaballs = App.config.numMetaballs;

    this.camera = App.camera;
    this.scene = App.scene;

    this.lightPos = App.lightPos;

    this.voxels = [];
    this.labels = [];

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
  i3toPos(i3)
  {
    return new THREE.Vector3(
      i3[0] * this.gridCellWidth + this.origin.x + this.halfCellWidth,
      i3[1] * this.gridCellWidth + this.origin.y + this.halfCellWidth,
      i3[2] * this.gridCellWidth + this.origin.z + this.halfCellWidth
      );
  };

  setupCells()
  {
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

  setupMetaballs()
  {
    balls = [];
    var x, y, z, vx, vy, vz, radius, pos, vel;
    var matLambertWhite = LAMBERT_WHITE;
    var maxRadiusTRippled = this.maxRadius * 3;
    var maxRadiusDoubled = this.maxRadius * 2;

    // Randomly generate metaballs with different sizes and velocities
    for (var i = 0; i < numMetaballs; i++) {
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
      balls.push(ball);

      if (VISUAL_DEBUG)
      {
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
    for (var i = 0; i < numMetaballs; i++)
    {
      var dist = balls[i].pos.distanceTo(point);
      dist = Math.max(dist, 0.001);
      isovalue += balls[i].radius2/(dist*dist);
    }

    return isovalue;
  }

  update()
  {
    if (this.isPaused)
    {
      //there should be no change in the isosurface when the movement is paused
      return;
    }

    // This should move the metaballs
    balls.forEach(function(ball)
    {
      ball.update();
    });

    for (var c = 0; c < this.res3; c++)
    {
      //Sampling at the vertices of the voxel instead
      //created 8 corner points inside the makeInspectPoints in voxel class
      this.voxels[c].corner[0].isovalue = this.sample(this.voxels[c].corner[0].pos);
      this.voxels[c].corner[1].isovalue = this.sample(this.voxels[c].corner[1].pos);
      this.voxels[c].corner[2].isovalue = this.sample(this.voxels[c].corner[2].pos);
      this.voxels[c].corner[3].isovalue = this.sample(this.voxels[c].corner[3].pos);
      this.voxels[c].corner[4].isovalue = this.sample(this.voxels[c].corner[4].pos);
      this.voxels[c].corner[5].isovalue = this.sample(this.voxels[c].corner[5].pos);
      this.voxels[c].corner[6].isovalue = this.sample(this.voxels[c].corner[6].pos);
      this.voxels[c].corner[7].isovalue = this.sample(this.voxels[c].corner[7].pos);

      //uncomment this chunk to turn on visual debugging; also make the global visual_debug flag true
      /*
      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid)
      {
        // Toggle voxels on or off
          if (this.voxels[c].center.isovalue > this.isolevel) {
            this.voxels[c].show();
          } else {
            this.voxels[c].hide();
          }

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
      */
    }
    this.updateMesh();

    color_Material.lightPos = this.lightPos;
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

    var trigeo = new THREE.Geometry();
    this.mesh = new THREE.Mesh(trigeo, color_Material);
    this.mesh.geometry.dynamic = true;

    this.scene.add(this.mesh);
  }

  updateMesh()
  {
      //now that all the triangles exist as a mesh, update them every frame via this function
      var vertexPos = [];
      var faces = [];

      for (var c = 0; c < this.res3; c++)
      {
        //get vertex data for every voxel from polygonize() and use it to update the overall mesh
        var VertexData = this.voxels[c].polygonize(this.isolevel);

        var offset = vertexPos.length;
        for (var j = 0; j < VertexData.vertPositions.length; j+=3)
        {
          vertexPos.push(VertexData.vertPositions[j]);
          vertexPos.push(VertexData.vertPositions[j+1]);
          vertexPos.push(VertexData.vertPositions[j+2]);

          var vertnors = [VertexData.vertNormals[j], VertexData.vertNormals[j+1], VertexData.vertNormals[j+2]];
          var face = new THREE.Face3(offset+j, offset+j+1, offset+j+2, vertnors);

          faces.push(face);
        }
      }

      this.mesh.geometry.vertices = vertexPos;
      this.mesh.geometry.faces = faces;

      //just inform three.js that the mesh has been updated
      this.mesh.geometry.verticesNeedUpdate = true;
      this.mesh.geometry.elementsNeedUpdate = true;
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
    this.corner = []; //new Array(8); //array of the 8 sample points at the corners of every grid cell

    if (VISUAL_DEBUG) {
      this.makeMesh();
    }

    this.makeInspectPoints();
  }

  //create geometry for the actual voxel grid; used only in debug mode
  makeMesh()
  {
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

  //creates points on the voxel gris that we can inspect for their isolevel
  makeInspectPoints()
  {
    var halfGridCellWidth = this.gridCellWidth / 2.0;
    var x = this.pos.x;
    var y = this.pos.y;
    var z = this.pos.z;
    var red = 0xff0000;

    //Paul Brooke's vertex indexing scheme; practically the indexing scheme can
    // be whatever you want as long as it is consistent
    //However for ease of understanding what is going on use this indexing scheme
    //as there are useful diagrams on Paul Brookes website
    this.corner[0] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner[1] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner[2] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner[3] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y - halfGridCellWidth, z + halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner[4] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner[5] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z - halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner[6] = new InspectPoint(new THREE.Vector3(x + halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth),
                                    0, new THREE.Vector3(0.0, 0.0, 1.0), VISUAL_DEBUG);
    this.corner[7] = new InspectPoint(new THREE.Vector3(x - halfGridCellWidth, y + halfGridCellWidth, z + halfGridCellWidth),
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

    //edge cases
    if ( Math.abs(isolevel - vertA.isolevel) < 0.00001 )
    {
      return VertA;
    }
    if ( Math.abs(isolevel - vertB.isolevel) < 0.00001 )
    {
      return VertB;
    }
    if ( Math.abs(vertA.isolevel - vertB.isolevel) < 0.00001 )
    {
      return VertA;
    }

    //actual LERPing
    lerpPos.x = vertA.pos.x + (isolevel - vertA.isovalue)/(vertB.isovalue - vertA.isovalue)*(vertB.pos.x - vertA.pos.x);
    lerpPos.y = vertA.pos.y + (isolevel - vertA.isovalue)/(vertB.isovalue - vertA.isovalue)*(vertB.pos.y - vertA.pos.y);
    lerpPos.z = vertA.pos.z + (isolevel - vertA.isovalue)/(vertB.isovalue - vertA.isovalue)*(vertB.pos.z - vertA.pos.z);
    return lerpPos;
  }

  //sampleNormal returns the normal of the isosurface for some point
  // in sapce in accordance to the field function the defines everything.
  sampleNormal(point)
  {
    //We can determine this by calculating the isovalue at 6 points a small delta
    //value away in the positive and negative of each axis, around the point in question.
    //This give us a gradient change along every axis which when normalised can give us the
    //normal at that point
    var isovalueposdx = 0.0;
    var isovaluenegdx = 0.0;
    var isovalueposdy = 0.0;
    var isovaluenegdy = 0.0;
    var isovalueposdz = 0.0;
    var isovaluenegdz = 0.0;

    for (var i = 0; i < numMetaballs; i++)
    {
      var distposdx = balls[i].pos.distanceTo(new THREE.Vector3(point.x + 0.00001, point.y, point.z));
      var distnegdx = balls[i].pos.distanceTo(new THREE.Vector3(point.x - 0.00001, point.y, point.z));
      var distposdy = balls[i].pos.distanceTo(new THREE.Vector3(point.x, point.y + 0.00001, point.z));
      var distnegdy = balls[i].pos.distanceTo(new THREE.Vector3(point.x, point.y - 0.00001, point.z));
      var distposdz = balls[i].pos.distanceTo(new THREE.Vector3(point.x, point.y, point.z + 0.00001));
      var distnegdz = balls[i].pos.distanceTo(new THREE.Vector3(point.x, point.y, point.z - 0.00001));

      isovalueposdx += balls[i].radius2/(distposdx*distposdx);
      isovaluenegdx += balls[i].radius2/(distnegdx*distnegdx);
      isovalueposdy += balls[i].radius2/(distposdy*distposdy);
      isovaluenegdy += balls[i].radius2/(distnegdy*distnegdy);
      isovalueposdz += balls[i].radius2/(distposdz*distposdz);
      isovaluenegdz += balls[i].radius2/(distnegdz*distnegdz);
    }

    return (new THREE.Vector3( isovaluenegdx - isovalueposdx,
                               isovaluenegdy - isovalueposdy,
                               isovaluenegdz - isovalueposdz).normalize());
  }

  polygonize(isolevel) //called by a voxel
  {
    var vertexList = [];
    var normalList = [];

    var cubeindex = 0;

    var temp;

    //This for loop simply checks whcih corners of the voxel exceed the isolevel,
    // and then add it to the 8bit number, "cubeindex"
    for(var i=0; i<8; i++)
    {
      temp = Math.ceil(this.corner[i].isovalue - isolevel);
      temp = Math.max(0.0, Math.min(1.0, temp)); //clamp function

      cubeindex += temp*Math.pow(2.0,i);
    }

    var edges = LUT.EDGE_TABLE[cubeindex]; // retruns a 12 bit number as a
                                          // sort of bit switch for the edges
                                          // which are being intersected

    //Voxel is entirely in/out of the surface od the metaball
    if (edges == 0)
    {
      return {
        vertPositions: vertexList,
        vertNormals: normalList
      };
    }

    //Find the vertices(on the edges) where the metaball intersects the voxel
    var lerpedEdgePoints = new Array(12);

    for(var i=0.0; i<12; i++)
    {
        if(edges & Math.pow(2,i))
        {
          lerpedEdgePoints[i] = this.vertexInterpolation(isolevel,
                                                         this.corner[indexLookup[i*2.0]],
                                                         this.corner[indexLookup[(i*2.0)+1]]);
        }
    }

    //Create the triangle(s) (upto 5 triangles) andstore those vertices into the vertexList

    //for loop stops at -1 because we've made the last int stored in every row of the in the TRI_TABLE == -1
    //the other values can be up to 15 vertices for the triangles

    for(var i = 0; LUT.TRI_TABLE[cubeindex * 16 + i]!=-1; i++)
    {
      //push lerped vertex points and normals for those points for the triangles in the voxel
      vertexList.push(lerpedEdgePoints[LUT.TRI_TABLE[cubeindex * 16 + i]]);
      normalList.push(this.sampleNormal(lerpedEdgePoints[LUT.TRI_TABLE[cubeindex * 16 + i]]));
    }

    return {
      vertPositions: vertexList,
      vertNormals: normalList
    };
  }
}
