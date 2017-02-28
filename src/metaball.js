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
    this.vd = visualDebug;

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
    //return;
    var newvel = new THREE.Vector3(0,0,0);
    newvel.addVectors(this.pos, this.vel);

    if(newvel.x-this.radius > 0 && newvel.x+this.radius < this.gridWidth) {
        this.pos.x += this.vel.x;
    }
    else {
        this.vel.x = -this.vel.x;
        this.pos.x += this.vel.x;
    }

    if(newvel.y-this.radius > 0 && newvel.y+this.radius < this.gridWidth) {
        this.pos.y += this.vel.y;
    }
    else {
        this.vel.y = -this.vel.y;
        this.pos.y += this.vel.y;
    }

    if(newvel.z-this.radius > 0 && newvel.z+this.radius < this.gridWidth) {
        this.pos.z += this.vel.z;
    }
    else {
        this.vel.z = -this.vel.z;
        this.pos.z += this.vel.z;
    }
    //debugger;
    //this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    if (this.vd) {
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    }
  }
}
