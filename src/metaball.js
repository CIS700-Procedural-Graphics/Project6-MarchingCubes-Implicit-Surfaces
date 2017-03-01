const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });

var frame = 0;

export default class Metaball {
  constructor(pos, radius, vel, gridWidth, visualDebug) {
    this.init(pos, radius, vel, gridWidth, visualDebug);
  }

  init(pos, radius, vel, gridWidth, maxRadius, visualDebug) {
    this.gridWidth = gridWidth;
    this.pos = pos;
    this.vel = vel;

    this.maxRadius = maxRadius;
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

  update(i) {
    
    var offset = 1.0;
	  
		var x = this.pos.x + offset + this.radius;
		var minX = this.pos.x - offset - this.radius;

    var y = this.pos.y + offset + this.radius;
    var minY = this.pos.y - offset - this.radius;

    var z = this.pos.z + offset + this.radius;
    var minZ = this.pos.z - offset - this.radius;

    if (x >= this.gridWidth || minX <= 0.0) {
      this.vel.x = -this.vel.x;
    }
    if (y >= this.gridWidth || minY <= 0.0) {
      this.vel.y = -this.vel.y;
    }
    if (z >= this.gridWidth || minZ <= 0.0) {
      this.vel.z = -this.vel.z;
    }

    
		//this.pos.x += this.vel.x;
    //this.pos.y += this.vel.y;
		//this.pos.z += this.vel.z;
    var angleOffset = 2.0 * Math.PI / 360;
    var origin = this.gridWidth / 2;
    var radius = this.gridWidth / 2 - this.maxRadius*2-1;
    this.pos.x = origin + radius * Math.cos(angleOffset*frame*i/20);
    this.pos.y = origin + radius * Math.sin(angleOffset*frame*i/20);
    frame++;
    
    if (this.mesh)
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}