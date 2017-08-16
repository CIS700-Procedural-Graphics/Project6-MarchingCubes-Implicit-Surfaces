const THREE = require('three')

var SPHERE_GEO = new THREE.SphereBufferGeometry(1, 32, 32);
var LAMBERT_WHITE = new THREE.MeshLambertMaterial( { color: 0x9EB3D8, transparent: true, opacity: 0.5 });
var offset = 0.1;

//This class creates the spheres that move around in the voxelised
// grid and are emanation points for the field values.
//The field values when summed together give you iso-surface.

export default class Metaball 
{
  constructor(pos, radius, vel, gridWidth, gridHeight, gridDepth, visualDebug) 
  {
    this.init(pos, radius, vel, gridWidth, gridHeight, gridDepth, visualDebug);
  }

  init(pos, radius, vel, gridWidth, gridHeight, gridDepth, visualDebug) 
  {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.gridDepth = gridDepth;
    this.pos = pos;
    this.vel = vel;

    this.visualDebug = visualDebug;

    this.radius = radius;
    offset = 1.9 * radius; //offset is more than radius because we can have influences from multiple spheres
    this.radius2 = radius * radius;
    this.mesh = null;

    this.makeMesh();
  }

  makeMesh() 
  {
    //create mesh for metaball
    this.mesh = new THREE.Mesh(SPHERE_GEO, LAMBERT_WHITE);
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.scale.set(this.radius, this.radius, this.radius);
  }

  show() 
  {
    if (this.mesh) 
    {
      this.mesh.visible = true;
    }
  };

  hide() 
  {
    if (this.mesh) 
    {
      this.mesh.visible = false;
    }
  };

  update()
  {
    //move metaballs inside voxel grid;
    // changing the direction of velocity when the metaball comes
    // close enough to the boundary of the voxel grid
    if((this.pos.x >= this.gridWidth - offset) || (this.pos.x <= offset))
    {
      this.vel.x = -this.vel.x;
    }
    if((this.pos.y >= this.gridHeight - offset*0.7) || (this.pos.y <= offset*0.7))
    {
      this.vel.y = -this.vel.y;
    }
    if((this.pos.z >= this.gridDepth - offset) || (this.pos.z <= offset))
    {
      this.vel.z = -this.vel.z;
    }

    this.pos.x += this.vel.x;
    this.pos.y += 2*this.vel.y;
    this.pos.z += this.vel.z;
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}
