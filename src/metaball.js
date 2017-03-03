const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });
var clock;

export default class Metaball {
  constructor(pos, radius, vel, gridWidth, visualDebug) {
    this.init(pos, radius, vel, gridWidth, visualDebug);
    clock = new THREE.Clock();
  }

  init(pos, radius, vel, gridWidth, visualDebug) {
    this.gridWidth = gridWidth;
    this.pos = pos;
    
    //start position for boundary calc
    this.startPos = this.pos.clone();

    this.vel = vel;

    // console.log(this.pos);

    this.radius = radius;
    this.radius2 = radius * radius;
    this.mesh = null;
    this.makeMesh();

    // if (visualDebug) {      
    //   this.makeMesh();
    // }
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
    var padding = this.radius * 1.2;

    //reverse velocity if outside radius from center
    if (Math.abs(this.startPos.distanceTo(this.pos)) > (this.gridWidth/2.0 - padding)){
      this.vel.multiplyScalar(-1.0);
    }


    var newPos = this.pos.add(this.vel);;
    // this.pos.add(v);
    this.mesh.position.set(newPos.x, newPos.y, newPos.z);
  }
}