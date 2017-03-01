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
    
    // If we are at the edge of the grid, bounce off the wall by inverting the direction
    // Account for the radius of the sphere
    // Add a small buffer amount for boundary checks because metaballs are not well-defined at the borders
    
    var buffer = 0.5;
    
    // Check the upper and lower bounds of the grid along each axis
    if(this.pos.x - this.radius - buffer < 0 || this.pos.x + this.radius + buffer > this.gridWidth) {
      this.vel.x *= -1;
    }
    if(this.pos.y - this.radius - buffer < 0 || this.pos.y + this.radius + buffer > this.gridWidth) {
      this.vel.y *= -1;
    }
    if(this.pos.z - this.radius - buffer < 0 || this.pos.z + this.radius + buffer > this.gridWidth) {
      this.vel.z *= -1;
    }
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.pos.z += this.vel.z;
    
    if(this.mesh) {
      this.mesh.position.x += this.vel.x;
      this.mesh.position.y += this.vel.y;
      this.mesh.position.z += this.vel.z;
    }
  }
}