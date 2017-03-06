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
    this.mesh.geometry.dynamic = true;
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

  update(visualDebug) {
    // TODO: Move metaball position based on its velocity
    // Reverse the velocity whenever the metaball goes out of bounds
    var thres = this.radius + this.gridWidth * 0.1;
    var max = this.gridWidth - thres;
    var pos = this.pos;
    if (pos.x < thres || pos.y < thres || pos.z < thres ||
        pos.x > max || pos.y > max || pos.z > max) {
      this.vel.multiplyScalar(-1);
    }
    this.pos.set(pos.x + this.vel.x, pos.y + this.vel.y, pos.z + this.vel.z);
    if (visualDebug) {
      if (!this.mesh) {
        this.makeMesh();
      }
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.mesh.geometry.verticesNeedUpdate = true;
    }
  }
}
