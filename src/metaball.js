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
    // @TODO // @DONE
      
      ///Check IF the meatball has reached the boundary of the grid
      ///   IF reached the boundary negate the velocity
      ///   ELSE update velocity  
      
      //return;
//      debugger;
//      var x_bound = ( this.mesh.position.x + this.radius >= 2 ) && ( this.mesh.position.x + this.radius <= 8  );
//      var y_bound = ( this.mesh.position.y + this.radius >= 2 ) && ( this.mesh.position.y + this.radius <= 8  );
//      var z_bound = ( this.mesh.position.z + this.radius >= 2 ) && ( this.mesh.position.z + this.radius <= 8  );
//      
//      
//      if( x_bound && y_bound && z_bound ){
//          //updating the velocity
//          this.mesh.position.set(this.mesh.position.x + this.vel.x, this.mesh.position.y + this.vel.y, this.mesh.position.z + this.vel.z);
//      }
//      else{
//          //negating the velocity
//          this.vel.x = -this.vel.x;
//          this.vel.y = -this.vel.y;
//          this.vel.z = -this.vel.z;
//        
//          //updating the velocity
//          this.mesh.position.set(this.mesh.position.x + this.vel.x, this.mesh.position.y + this.vel.y, this.mesh.position.z + this.vel.z);
//          
//      }
      
      
      //debugger;
      var x_bound = ( this.pos.x + this.radius >= 1 ) && ( this.pos.x + this.radius <= 9  );
      var y_bound = ( this.pos.y + this.radius >= 1 ) && ( this.pos.y + this.radius <= 9  );
      var z_bound = ( this.pos.z + this.radius >= 1 ) && ( this.pos.z + this.radius <= 9  );
      
      
      if( x_bound && y_bound && z_bound ){
          //updating the velocity
          this.pos.set(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
      }
      else{
          //negating the velocity
          this.vel.x = -this.vel.x;
          this.vel.y = -this.vel.y;
          this.vel.z = -this.vel.z;
        
          //updating the velocity
          this.pos.set(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
          
      }
      
  }
}