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
    var margin = 0.1;
    var pos = this.mesh.position.clone();

    var min = margin + this.radius;
    var max = this.gridWidth - margin - this.radius;

    pos.add(this.vel);

    if (pos.x >= max || pos.y >= max || pos.z >= max ||
        pos.x <= min || pos.y <= min || pos.z <= min) {
      this.vel.multiplyScalar(-1);
    }

    this.pos.add(this.vel);
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}