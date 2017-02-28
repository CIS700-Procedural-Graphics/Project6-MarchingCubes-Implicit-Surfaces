const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial({ color: 0x9EB3D8, transparent: true, opacity: 0.5 });

export default class Metaball {
  constructor(pos, radius, vel, gridWidth, visualDebug) {
    this.init(pos, radius, vel, gridWidth, visualDebug);
  }

  init(pos, radius, vel, gridWidth, visualDebug) {
    this.gridWidth = gridWidth;
    this.pos = pos;
    this.vel = vel;

    this.radius = radius;
    this.radius2 = radius * radius;
    this.mesh = null;

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

  isOOB(pos) {
    var margin = 2.0;
    return pos.x < 0 + margin || pos.x > this.gridWidth - margin ||
           pos.y < 0 + margin || pos.y > this.gridWidth - margin ||
           pos.z < 0 + margin || pos.z > this.gridWidth - margin;
  };

  update() {
    var new_pos = new THREE.Vector3(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
    if (this.isOOB(new_pos)) {
      this.vel = new THREE.Vector3(-this.vel.x, -this.vel.y, -this.vel.z)
      new_pos = new THREE.Vector3(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
    }
    this.pos = new_pos;
    if (this.mesh) {
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    }
  }

  density(r) {
    return Math.exp(-r * r * 8);
  }
}
