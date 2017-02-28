const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });
var offset = 0.1;

export default class Metaball {
  constructor(pos, radius, vel, gridWidth, visualDebug) {
    this.init(pos, radius, vel, gridWidth, visualDebug);
  }

  init(pos, radius, vel, gridWidth, visualDebug) {
    this.gridWidth = gridWidth;
    this.pos = pos;
    this.vel = vel;

    this.visualDebug = visualDebug;

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

  update()
  {
    // console.log(this.gridWidth);
      if((this.pos.x >= this.gridWidth - offset) || (this.pos.x <= offset))
      {
        this.vel.x = -this.vel.x;
      }
      if((this.pos.y >= this.gridWidth - offset) || (this.pos.y <= offset))
      {
        this.vel.y = -this.vel.y;
      }
      if((this.pos.z >= this.gridWidth - offset) || (this.pos.z <= offset))
      {
        this.vel.z = -this.vel.z;
      }

      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;
      this.pos.z += this.vel.z;
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}
