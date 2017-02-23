const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });

var boolFirst = true;

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
    this.updateMeshPos();
  }

  updateMeshPos() {
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

    // @TODO - make the meatball move 
    /********************************************************************************************************/
    // move its position based velocity. Reverse the velocity whenever the metaball goes out of bounds.
    // Since the metaball function is not well defined at the boundaries, maintain an additional small margin
    // so that the metaball can reverse its moving direction before reaching the bounds.
    /********************************************************************************************************/

    var marginBeforeBounds = 0.5 + this.radius;
    var newPos = new THREE.Vector3(0.0, 0.0, 0.0);

    newPos = new THREE.Vector3(this.vel.x + this.pos.x,
                               this.vel.y + this.pos.y,
                               this.vel.z + this.pos.z);

    // if (!boolFirst) { return; } else { boolFirst = false; } // <-- used for testing updates so one iter

    // checking bounds with new pos
    var min = 0.0 + marginBeforeBounds;
    var max = 10.0 - marginBeforeBounds;
    //console.log(newPos);

    // within?
    var within = (newPos.x > min && newPos.x < max)
                  && (newPos.y > min && newPos.y < max)
                  && (newPos.z > min && newPos.z < max);
    //console.log("updated velocity from : " + this.vel.x + "," + this.vel.y + "," + this.vel.z);
    if (!within) {
      this.vel.x *= -1.0;
      this.vel.y *= -1.0;
      this.vel.z *= -1.0;
    } else {
      this.pos = newPos;
      this.updateMeshPos();
    }
  }

}//end: Metaball class