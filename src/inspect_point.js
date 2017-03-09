const THREE = require('three');

const POINT_MATERIAL = new THREE.PointsMaterial( { color: 0xee1111, size: 10, sizeAttenuation: true } );

//This entire class is used only for debugging to display iso-values at the gridpoints
export default class InspectPoint {

  constructor(pos, isovalue, isonormal, visualDebug) {
    this.init(pos, isovalue, isonormal, visualDebug);
  }

  init(pos, isovalue, isonormal, visualDebug) {
    this.pos = pos;
    this.isovalue = isovalue;
    this.isonormal = isonormal;
    this.label = null;

    if (visualDebug) {
      this.makeLabel();
    }
  };

  // Create an HTML div for holding label
  makeLabel() {
    this.label = document.createElement('div');
    this.label.style.position = 'absolute';
    this.label.style.width = 100;
    this.label.style.height = 100;
    this.label.style.userSelect = 'none';
    this.label.style.cursor = 'default';
    this.label.style.fontSize = '0.7em';
    this.label.style.pointerEvents = 'none';
    document.body.appendChild(this.label);
  };

  updateLabel(camera) {
    if (this.label) {
      var screenPos = this.pos.clone().project(camera);
      screenPos.x = ( screenPos.x + 1 ) / 2 * window.innerWidth;;
      screenPos.y = - ( screenPos.y - 1 ) / 2 *  window.innerHeight;;

      this.label.style.top = screenPos.y + 'px';
      this.label.style.left = screenPos.x + 'px';
      this.label.innerHTML = this.isovalue.toFixed(2);
      //for dynamic opacity that changes wrt the isolevel
      // this.label.style.opacity = this.isovalue - 0.5;
    }
  };

  clearLabel() {
    if (this.label) {
      this.label.innerHTML = '';
      this.label.style.opacity = 0;
    }
  };
}
