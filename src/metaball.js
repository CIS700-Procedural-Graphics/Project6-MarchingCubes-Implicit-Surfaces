const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });

export default class Metaball {
  constructor(pos, radius, maxSpeed, gridWidth, visualDebug) {
    this.init(pos, radius, maxSpeed, gridWidth, visualDebug);
  }

  init(pos, radius, maxSpeed, gridWidth, visualDebug) {
    this.gridWidth = gridWidth;
    this.pos = pos;

    this.maxSpeed = maxSpeed;
    this.vel = new THREE.Vector3((Math.random()*2 - 1)*maxSpeed, (Math.random()*2 - 1)*maxSpeed, (Math.random()*2 - 1)*maxSpeed);

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
      //update position
      this.pos = new THREE.Vector3(this.pos.x+this.vel.x, this.pos.y+this.vel.y, this.pos.z+this.vel.z);
      if (this.visualDebug) {
        this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
      }

      /*
      //if nearing edge of grid, multiply velocity by -1.0
      if (this.pos.x > this.gridWidth - 2*this.radius || this.pos.y > this.gridWidth - 2*this.radius || this.pos.z > this.gridWidth - 2*this.radius ||
        this.pos.x < 0.0 + 2*this.radius || this.pos.y < 0.0 + 2*this.radius || this.pos.z < 0.0 + 2*this.radius) {
        this.vel.multiplyScalar(-1.0);
      }
      */

      var halfGridWidth = this.gridWidth/2.0;
      
      //case when metaball hits the roof of lava lamp
      if ( this.pos.y > this.gridWidth - 2*this.radius) {
        //var normal = new THREE.Vector3(0, -1, 0);
        //this.vel = this.vel.sub(normal.multiplyScalar(this.vel.dot(normal)*2));
        this.vel = new THREE.Vector3((Math.random()*2 - 1)*this.maxSpeed, (Math.random()*-1)*this.maxSpeed, (Math.random()*2 - 1)*this.maxSpeed);
      } 
      //case when metaball hits the floor of lava lamp
      else if ( this.pos.y < 0.0 + 2*this.radius ) {
        //var normal = new THREE.Vector3(0, 1, 0);
        //this.vel = this.vel.sub(normal.multiplyScalar(this.vel.dot(normal)*2));
        this.vel = new THREE.Vector3((Math.random()*2 - 1)*this.maxSpeed, (Math.random())*this.maxSpeed, (Math.random()*2 - 1)*this.maxSpeed);
      }
      //case when metal hits the edge of lava lamp, get the reflection vector
      //http://math.stackexchange.com/questions/13261/how-to-get-a-reflection-vector
      else if ( (this.pos.x-halfGridWidth)*(this.pos.x-halfGridWidth)+(this.pos.z-halfGridWidth)*(this.pos.z-halfGridWidth) >= (2.4-this.radius)*(2.4-this.radius) ) {
        var normal = new THREE.Vector3(halfGridWidth-this.pos.x, 0, halfGridWidth-this.pos.z).normalize();
        this.vel = this.vel.sub(normal.multiplyScalar(this.vel.dot(normal)*2));
      }
  }
}