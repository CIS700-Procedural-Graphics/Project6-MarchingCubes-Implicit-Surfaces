const THREE = require('three');

import Metaball from './metaball.js';
import InspectPoint from './inspect_point.js'
import LUT from './marching_cube_LUT.js';
let VISUAL_DEBUG = true;

const LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
const LAMBERT_GREEN = new THREE.MeshBasicMaterial( { color: 0x00ee00, transparent: true, opacity: 0.5 });
const WIREFRAME_MAT = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } );

const NUM_MATS = 7;
export const MATERIALS = ['Tarnished', 'Metal', 'Clay', 'Brass', 'Plastic', 'Marble', 'Shiny'];

const v3 = (x, y, z) => {return new THREE.Vector3(x, y, z);};
const E = 1e-3;
const STD_UNIFORMS = (obj) => {
  return Object.assign({
    texture: {
      type: "t",
      value: null
    },
    u_ambient: {
      type: 'v3',
      value: new THREE.Color(0xFFFFFF)
    },
    u_lightCol: {
      type: 'v3',
      value: new THREE.Color(0xFFFFFF)
    },
    u_lightPos: {
      type: 'v3',
      value: new THREE.Vector3(5, 10, 10)
    },
    u_lightIntensity: {
      type: 'f',
      value: 1.0
    },
    u_viewPos: {
      type: 'v3',
      value: window.viewPos
    }
  }, obj);
};
export const SHADERS = {
  'Lambert': new THREE.ShaderMaterial({
    uniforms: STD_UNIFORMS(),
    vertexShader: require('../shaders/vert.glsl'),
    fragmentShader: require('../shaders/frag.glsl')
  }),
  'Lit Sphere': new THREE.ShaderMaterial({
    uniforms: STD_UNIFORMS({
      matTexture: {
        type: "t",
        value: null
      },
    }),
    vertexShader: require('../shaders/lit-vert.glsl'),
    fragmentShader: require('../shaders/lit-frag.glsl')
  }),
  'Toon': new THREE.ShaderMaterial({
    uniforms: STD_UNIFORMS(),
    vertexShader: require('../shaders/vert.glsl'),
    fragmentShader: require('../shaders/toon-frag.glsl')
  })
};

let matLoaded = Promise.all([...Array(NUM_MATS).keys()].map(i => {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(require(`../assets/${i}.bmp`), function(texture) {
      resolve(texture);
    });
  });
}));
let loader = {};
matLoaded.then(textures => {
  console.log("Textures Loaded");
  textures.forEach((t, i) => {
    loader[i] = t;
  });
  MATERIALS.forEach((m, i) => {
    loader[m] = loader[i]
  });
  SHADERS['Lit Sphere'].uniforms.matTexture.value = loader['Tarnished'];
});

export default class MarchingCubes {

  constructor(App) {
    this.init(App);
  }

  init(App) {
    this.isPaused = false;
    VISUAL_DEBUG = App.config.visualDebug;

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

    this.shader = App.config.shader;

    this.scene.remove(this.mesh);

    if (App.config.material) {
      this.material = new THREE.MeshPhongMaterial({ color: 0xff6a1d});
    } else {
      this.material = App.config.material;
    }

    this.setupCells();
    this.setupMetaballs();
    this.makeMesh();
  };

  changeMat(value) {
    SHADERS['Lit Sphere'].uniforms.matTexture.value = loader[value];
  }

  updateBallSpeed(value) {
    this.balls.forEach(ball => {
      let { vel: {x, y, z} } = ball;
      ball.vel = v3((Math.abs(x) / x) * value, (Math.abs(y) / y) * value, (Math.abs(z) / z) * value).multiply(ball.baseVel);
    });
  }

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
    for (let i = 0; i < this.res3; i++) {
      let i3 = this.i1toi3(i);
      let {x, y, z} = this.i3toPos(i3);
      let voxel = new Voxel(new THREE.Vector3(x, y, z), this.gridCellWidth);
      this.voxels.push(voxel);

      if (VISUAL_DEBUG) {
        this.scene.add(voxel.wireframe);
        this.scene.add(voxel.mesh);
      }
    }
  }

  setupMetaballs() {

    this.balls = [];

    let x, y, z, vx, vy, vz, radius, pos, vel;
    let matLambertWhite = LAMBERT_WHITE;
    let maxRadiusTRippled = this.maxRadius * 3;
    let maxRadiusDoubled = this.maxRadius * 2;

    // Randomly generate metaballs with different sizes and velocities
    for (let i = 0; i < this.numMetaballs; i++) {
      x = this.gridWidth / 2;
      y = this.gridWidth / 2;
      z = this.gridWidth / 2;
      pos = new THREE.Vector3(x, y, z);

      vx = (Math.random() * 2 - 1) * this.maxSpeed;
      vy = (Math.random() * 2 - 1) * this.maxSpeed;
      vz = (Math.random() * 2 - 1) * this.maxSpeed;
      vel = new THREE.Vector3(vx, vy, vz);

      radius = Math.random() * (this.maxRadius - this.minRadius) + this.minRadius;

      let ball = new Metaball(pos, radius, vel, this.gridWidth, this.isolevel, VISUAL_DEBUG);
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
    let isoValue = 0.0;
    this.balls.forEach(ball => {
      isoValue += ball.radius2 / point.distanceToSquared(ball.pos);
    });
    return isoValue;
  }

  update() {

    if (this.isPaused) {
      return;
    }

    // This should move the metaballs
    this.balls.forEach(function(ball) {
      ball.update();
    });

    for (let c = 0; c < this.res3; c++) {

      // Sampling the center point
      this.voxels[c].center.isovalue = this.sample(this.voxels[c].center.pos);
      this.voxels[c].corners.forEach(c => {
        c.isovalue = this.sample(c.pos);
      });

      // Visualizing grid
      if (VISUAL_DEBUG && this.showGrid) {
        // Toggle voxels on or off
        if (this.voxels[c].center.isovalue > this.isolevel || this.voxels[c].corners.some(e => {return e.isovalue > this.isolevel;})) {
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
    for (let i = 0; i < this.res3; i++) {
      this.voxels[i].show();
    }
    this.showGrid = true;
  };

  hide() {
    for (let i = 0; i < this.res3; i++) {
      this.voxels[i].hide();
    }
    this.showGrid = false;
  };

  makeMesh() {
    this.mesh = new THREE.Mesh(new THREE.Geometry(), SHADERS[this.shader]);
    this.mesh.geometry.dynamic = true;
    this.scene.add(this.mesh);
  }

  updateMesh() {
    let vertices = [];
    let faces = [];
    this.voxels.forEach(v => {
      let {vPos, vNor} = v.polygonize(this.isolevel, this.sample.bind(this));
      for (let i = 0; i < vPos.length / 3; i++) {
        vertices.push(vPos[3 * i], vPos[3 * i + 1], vPos[3 * i + 2]);
        let normals = [vNor[3 * i], vNor[3 * i + 1], vNor[3 * i + 2]];
        let fl = faces.length;
        faces.push(new THREE.Face3(fl * 3, fl * 3 + 1, fl * 3 + 2, normals));
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
    this.corners = [];
    if (VISUAL_DEBUG) {
      this.makeMesh();
    }

    this.makeInspectPoints();
  }

  makeMesh() {
    let halfGridCellWidth = this.gridCellWidth / 2.0;

    let positions = new Float32Array([
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

    let indices = new Uint16Array([
      0, 1, 2, 3,
      4, 5, 6, 7,
      0, 7, 7, 4,
      4, 3, 3, 0,
      1, 6, 6, 5,
      5, 2, 2, 1
    ]);

    // Buffer geometry
    let geo = new THREE.BufferGeometry();
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
    let hw = this.gridCellWidth / 2.0;
    let x = this.pos.x;
    let y = this.pos.y;
    let z = this.pos.z;
    let red = 0xff0000;

    // Center dot
    this.center = new InspectPoint(new THREE.Vector3(x, y, z), 0, VISUAL_DEBUG);
    this.corners.push(new InspectPoint(new THREE.Vector3(x - hw, y - hw, z - hw), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x + hw, y - hw, z - hw), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x + hw, y - hw, z + hw), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x - hw, y - hw, z + hw), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x - hw, y + hw, z - hw), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x + hw, y + hw, z - hw), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x + hw, y + hw, z + hw), 0, VISUAL_DEBUG));
    this.corners.push(new InspectPoint(new THREE.Vector3(x - hw, y + hw, z + hw), 0, VISUAL_DEBUG));
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
    let t = (isolevel - posA.isovalue) / (posB.isovalue - posA.isovalue);
    return new THREE.Vector3().lerpVectors(posA.pos, posB.pos, t);
  }

  polygonize(isolevel, sample) {
    let vPos = [];
    let vNor = [];

    let idx = 0;
    let c = 1;
    for (let i = 0; i < 8; i++) {
      if (this.corners[i].isovalue > isolevel) idx |= c;
      c <<= 1;
    }

    let pts = [];
    let edges = LUT.EDGE_TABLE[idx];

    for (let i = 0; i < 12; i++) {
      if (edges & (1 << i)) {
        pts[i] = this.vertexInterpolation(isolevel, this.corners[LUT.NEIGHBOR[2 * i]], this.corners[LUT.NEIGHBOR[2 * i + 1]]);
      }
    }

    for (let i = 0; i < 16; i++) {
      let tri = LUT.TRI_TABLE[16 * idx + i];
      if (tri < 0) break;
      let p = pts[tri];
      let sp = sample(p);
      let delta = v3(sample(v3(-E,0,0).add(p)), sample(v3(0,-E,0).add(p)), sample(v3(0,0,-E).add(p)));
      let normal = delta.subScalar(sp).normalize();
      // let normal = v3(0,0,0).addScalar(sample(p));
      vPos.push(p);
      vNor.push(normal);
    }
    return { vPos, vNor };
  };
}
