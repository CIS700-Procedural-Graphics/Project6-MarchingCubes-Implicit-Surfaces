const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });

export default class Metaball {
  constructor(pos, radius, vel, gridWidth, gridHeight, gridDepth, visualDebug) {
    this.init(pos, radius, vel, gridWidth, gridHeight, gridDepth, visualDebug);
  }

  init(pos, radius, vel, neg, gridWidth, gridHeight, gridDepth, visualDebug) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.gridDepth = gridDepth;
    this.pos = pos;
    this.vel = vel;
    this.neg = neg;
    this.radius = radius;
    this.radius2 = radius * radius;
    this.mesh = null;
    this.debug = visualDebug;
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

  //   var cir = new THREE.Vector3(this.pos.x, 0, this.pos.z);
  //   var disp = new THREE.Vector3(this.gridWidth/2, 0, this.gridWidth/2).sub(cir);
  //   var dist = cir.distanceTo(new THREE.Vector3(this.gridWidth/2, 0, this.gridWidth/2));
  //   if ((dist + 2*this.radius) > this.gridWidth 
  //     || (dist + 2*this.radius) > this.gridDepth) {
  //     this.vel.add(disp);
  // }
    var y = (this.pos.y + this.radius) > this.gridHeight || (this.pos.y + 2* this.radius) < 0;
    if (y) this.vel.y *= -1;
    
    var date = new Date();
    var velocity = new THREE.Vector3();
    velocity.copy(this.vel).multiplyScalar(3);
    this.pos.add(velocity);

    

    
    // if (x || y || z) {
    //   this.vel.multiplyScalar(-1);
    // }
    if (this.debug) this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}
