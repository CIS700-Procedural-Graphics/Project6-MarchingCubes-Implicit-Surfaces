const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });

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

  update() {
    // Check if out of bounds. If so, reverse velocity
    var margin = 1.0;
    if ((this.pos.x - this.radius) < 0 + margin || (this.pos.x + this.radius) > this.gridWidth - margin) {
      this.vel = new THREE.Vector3(-this.vel.x, this.vel.y, this.vel.z);
    }
    if ((this.pos.y - this.radius) < 0 + margin || (this.pos.y + this.radius) > this.gridWidth - margin) {
      this.vel = new THREE.Vector3(this.vel.x, -this.vel.y, this.vel.z);
    }
    if ((this.pos.z - this.radius) < 0 + margin || (this.pos.z + this.radius) > this.gridWidth - margin) {
      this.vel = new THREE.Vector3(this.vel.x, this.vel.y, -this.vel.z);
    }

    // Update velocity
    this.pos = new THREE.Vector3(this.vel.x + this.pos.x, this.vel.y + this.pos.y, this.vel.z + this.pos.z);
    if (this.mesh) {
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    }
  }
}