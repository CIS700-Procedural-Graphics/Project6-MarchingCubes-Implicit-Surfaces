const THREE = require('three')

let SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
let LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });
const E = 10;

export default class Metaball {
  constructor(pos, radius, vel, gridWidth, visualDebug) {
    this.init(pos, radius, vel, gridWidth, visualDebug);
  }

  init(pos, radius, vel, gridWidth, isolevel, visualDebug) {
    this.gridWidth = gridWidth;
    this.isolevel = isolevel;
    this.pos = pos;
    this.baseVel = vel.clone();
    this.vel = vel;
    // this.adj = isolevel < 1 ? (Math.abs(Math.log2(isolevel))) * 1.2 : 1.1;
    this.adj = 0.65;

    this.radius = radius;
    this.radius2 = radius * radius;
    this.mesh = null;
    this.visualDebug = visualDebug;
    if (visualDebug) {
      this.makeMesh();
    }
  }

  makeMesh() {
    this.mesh = new THREE.Mesh(SPHERE_GEO, LAMBERT_WHITE);
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.scale.set(this.radius, this.radius, this.radius);
  }

  show() {
    if (this.mesh) {
      this.mesh.visible = true;
    }
  };

  hide() {
    if (this.mesh) {
      this.mesh.visible = false;
    }
  };

  update() {
    let newPos = (new THREE.Vector3()).addVectors(this.pos, this.vel);
    if (newPos.x + this.radius + this.adj > this.gridWidth || newPos.x - this.radius - this.adj < 0) {
      this.vel.x *= -1;
    }
    if (newPos.y + this.radius + this.adj > this.gridWidth || newPos.y - this.radius - this.adj < 0) {
      this.vel.y *= -1;
    }
    if (newPos.z + this.radius + this.adj > this.gridWidth || newPos.z - this.radius - this.adj < 0) {
      this.vel.z *= -1;
    }
    this.pos.add(this.vel);
    if (this.visualDebug) {
      this.mesh.position.x = this.pos.x;
      this.mesh.position.y = this.pos.y;
      this.mesh.position.z = this.pos.z;
    }
  }
}
