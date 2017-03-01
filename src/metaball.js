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
    this.pos.x += this.vel.x; 
      if (this.pos.x >= 9 || this.pos.x <= 1) {
        this.vel.x *= -1; 
      }
    this.pos.y += this.vel.y; 
    if (this.pos.y >= 9 || this.pos.y <= 1) {
        this.vel.y *= -1; 
      }
    this.pos.z += this.vel.z; 
    if (this.pos.z >= 8 || this.pos.z <= 1) {
        this.vel.z *= -1; 
      }



    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}