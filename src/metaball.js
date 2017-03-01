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
    // @TODO
    this.mesh.position.x += this.vel.x;
    this.mesh.position.y += this.vel.y;
    this.mesh.position.z += this.vel.z;
    this.pos = this.mesh.position;
    var radius = this.radius;
    if (this.mesh.position.x > this.gridWidth - radius || 
        this.mesh.position.x <  radius ||
        this.mesh.position.y > this.gridWidth - radius || 
        this.mesh.position.y <  radius ||
        this.mesh.position.z > this.gridWidth - radius || 
        this.mesh.position.z <  radius) {
      this.vel.x = -this.vel.x;
      this.vel.y = -this.vel.y;
      this.vel.z = -this.vel.z;
    }
    
  }
}