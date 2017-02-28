require('file-loader?name=[name].[ext]!../index.html');

// Credit:
// http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
// http://paulbourke.net/geometry/polygonise/

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much

import Framework from './framework'
import LUT from './marching_cube_LUT.js'
import MarchingCubes, {MATERIALS, SHADERS} from './marching_cubes.js'



const DEFAULT_VISUAL_DEBUG = false;
const DEFAULT_ISO_LEVEL = 0.4;
const DEFAULT_GRID_RES = 20;
const DEFAULT_GRID_WIDTH = 10;
const DEFAULT_NUM_METABALLS = 4;
const DEFAULT_MIN_RADIUS = 0.5;
const DEFAULT_MAX_RADIUS = 1;
const DEFAULT_MAX_SPEED = 0.07;
const DEFAULT_SHADER = 'Lambert';
const DEFAULT_MATERIAL = 'Tarnished';


let App = {
  //
  marchingCubes:             undefined,
  config: {
    visualDebug:    DEFAULT_VISUAL_DEBUG,
    isolevel:       DEFAULT_ISO_LEVEL,
    gridRes:        DEFAULT_GRID_RES,
    gridWidth:      DEFAULT_GRID_WIDTH,
    gridCellWidth:  DEFAULT_GRID_WIDTH / DEFAULT_GRID_RES,
    numMetaballs:   DEFAULT_NUM_METABALLS,
    minRadius:      DEFAULT_MIN_RADIUS,
    maxRadius:      DEFAULT_MAX_RADIUS,
    maxSpeed:       DEFAULT_MAX_SPEED,
    shader:         DEFAULT_SHADER,
    material:       DEFAULT_MATERIAL
  },

  // Scene's framework objects
  camera:           undefined,
  scene:            undefined,
  renderer:         undefined,

  // Play/pause control for the simulation
  isPaused:         false
};

// called after the scene loads
function onLoad(framework) {

  let {scene, camera, renderer, gui, stats} = framework;
  App.scene = scene;
  App.camera = camera;
  App.renderer = renderer;

  renderer.setClearColor( 0xbfd1e5 );
  scene.add(new THREE.AxisHelper(20));
  setupCamera(App.camera);
  setupScene(App.scene);
  setupGUI(gui);
}

// called on frame updates
function onUpdate(framework) {
  if (App.marchingCubes) {
    App.marchingCubes.update();
  }
}

function setupCamera(camera) {
  // set camera position
  camera.position.set(5, 5, 30);
  camera.lookAt(new THREE.Vector3(0,0,0));
  window.viewPos = camera.position;
}

function setupScene(scene) {
  App.marchingCubes = new MarchingCubes(App);
}


function setupGUI(gui) {


  let shaderFolder = gui.addFolder('ShaderOptions');
  // --- CONFIG ---
  gui.add(App, 'isPaused').onChange(value => {
    App.isPaused = value;
    if (value) {
      App.marchingCubes.pause();
    } else {
      App.marchingCubes.play();
    }
  });

  gui.add(App.config, 'numMetaballs', 1, 10).step(1).onChange(value => {
    App.marchingCubes.init(App);
  });

  gui.add(App.config, 'maxSpeed', 0.01, 4).onChange(value => {
    App.marchingCubes.updateBallSpeed(value);
  });

  gui.add(App.config, 'isolevel', 0.0, 3).onChange(value => {
    App.marchingCubes.init(App);
  })

  gui.add(App.config, 'gridWidth', 0.0, 30).step(1).onChange(value => {
    App.marchingCubes.init(App);
    App.config.gridCellWidth = App.config.gridWidth / App.config.gridRes;
  })

  gui.add(App.config, 'gridRes', 0, 64).step(1).onChange(value => {
    App.marchingCubes.init(App);
    App.config.gridCellWidth = App.config.gridWidth / App.config.gridRes;
  })

  gui.add(App.config, 'shader', Object.keys(SHADERS)).onChange(value => {
    App.marchingCubes.init(App);
    gui.removeFolder('ShaderOptions');
    shaderFolder = gui.addFolder('ShaderOptions');
    shaderFolder.open();
    switch(value) {
      case 'Lambert':
        break;
      case 'Lit Sphere':
        shaderFolder.add(App.config, 'material', MATERIALS).onChange(value => {
          App.marchingCubes.changeMat(value);
        });
        break;
      case 'Toon':
        SHADERS['Toon'].uniforms.u_viewPos.value = App.camera.position;
        break;
    }

  });
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);
