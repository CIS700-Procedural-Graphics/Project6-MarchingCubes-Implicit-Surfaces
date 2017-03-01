const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 16, 16);
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
      
      var pos = new THREE.Vector3().addVectors(this.pos, this.vel);
      
      var min = 2 * this.radius;
      var max = this.gridWidth - min;
      
      if (pos.x > max || pos.x < min) {
        this.vel.x *= -1.0;
      }
      if (pos.y > max || pos.y < min) {
        this.vel.y *= -1.0;
      }
      if (pos.z > max || pos.z < min) {
        this.vel.z *= -1.0;
      }

      this.pos.add(this.vel);
  }
}