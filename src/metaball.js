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
      //update position
      this.pos = new THREE.Vector3(this.pos.x+this.vel.x, this.pos.y+this.vel.y, this.pos.z+this.vel.z);
      if (this.visualDebug) {
        this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
      }
      //if nearing edge of grid, multiply velocity by -1.0
      if (this.pos.x > this.gridWidth - this.radius || this.pos.y > this.gridWidth - this.radius || this.pos.z > this.gridWidth - this.radius ||
        this.pos.x < 0.0 + this.radius || this.pos.y < 0.0 + this.radius || this.pos.z < 0.0 + this.radius) {
        this.vel.multiplyScalar(-1.0);
      }
  }
}