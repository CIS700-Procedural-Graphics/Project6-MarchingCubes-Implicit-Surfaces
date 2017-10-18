require('file-loader?name=[name].[ext]!../index.html');

// Credit:
// http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
// http://paulbourke.net/geometry/polygonise/

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much

import Framework from './framework'
import LUT from './marching_cube_LUT.js'
import MarchingCubes from './marching_cubes.js'

const DEFAULT_VISUAL_DEBUG = false;
const DEFAULT_ISO_LEVEL = 1.0;
const DEFAULT_GRID_RES = 25; //20
const DEFAULT_GRID_WIDTH = 15;
const DEFAULT_NUM_METABALLS = 9; //20
const DEFAULT_MIN_RADIUS = 0.9; 
const DEFAULT_MAX_RADIUS = 0.9; //1
const DEFAULT_MAX_SPEED = 0.01;

var App = {
  // 
  marchingCubes:             undefined,
  config: {
    // Global control of all visual debugging. 
    // This can be set to false to disallow any memory allocation of visual debugging components. 
    // **Note**: If your application experiences performance drop, disable this flag.
    visualDebug:    DEFAULT_VISUAL_DEBUG,

    // The isolevel for marching cubes
    isolevel:       DEFAULT_ISO_LEVEL,

    // Grid resolution in each dimension. If gridRes = 4, then we have a 4x4x4 grid
    gridRes:        DEFAULT_GRID_RES,

    // Total width of grid
    gridWidth:      DEFAULT_GRID_WIDTH,

    // Width of each voxel
     // Ideally, we want the voxel to be small (higher resolution)
    gridCellWidth:  DEFAULT_GRID_WIDTH / DEFAULT_GRID_RES,

    // Number of metaballs
    numMetaballs:   DEFAULT_NUM_METABALLS,

    // Minimum radius of a metaball
    minRadius:      DEFAULT_MIN_RADIUS,

    // Maxium radius of a metaball
    maxRadius:      DEFAULT_MAX_RADIUS,

    // Maximum speed of a metaball
    maxSpeed:       DEFAULT_MAX_SPEED
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

  var {scene, camera, renderer, gui, stats, controls} = framework;
  App.scene = scene;
  App.camera = camera;
  App.renderer = renderer;
  App.controls = controls;

  renderer.setClearColor( 0xbfd1e5 );
  //scene.add(new THREE.AxisHelper(20));

  setupCamera(App.camera, App.controls);
  setupLights(App.scene);
  setupScene(App.scene);
  setupGUI(gui);
}

// called on frame updates
function onUpdate(framework) {

  if (App.marchingCubes) {
    App.marchingCubes.update();
  }
}

function setupCamera(camera, controls) {
  // set camera position
  camera.position.set(DEFAULT_GRID_WIDTH/2, DEFAULT_GRID_WIDTH/2, 20);
  camera.lookAt(new THREE.Vector3(DEFAULT_GRID_WIDTH/2,DEFAULT_GRID_WIDTH/2,0));
  controls.target.set(DEFAULT_GRID_WIDTH/2, DEFAULT_GRID_WIDTH/2, 0);
  controls.enabled = false;
}

function setupLights(scene) {

  // Directional light
  /*var directionalLight = new THREE.PointLight(0xffffff, 0.7);
  //directionalLight.color.setHSL(0.1, 1, 0.95);
  directionalLight.position.set(-20, 100, -30);
  directionalLight.position.multiplyScalar(10);

  scene.add(directionalLight);*/
  
  var directionalLight2 = new THREE.PointLight(0xffffff, 1);
  directionalLight2.position.set(5, 0, 20);
  //directionalLight2.position.multiplyScalar(10);

  scene.add(directionalLight2);
}

function setupScene(scene) {    
//  var textureLoaded = new Promise((resolve, reject) => {
//      (new THREE.TextureLoader()).load(require('./images/fabric.bmp'), function(texture) {
//          resolve(texture);
//      })
//  })
//  
//  textureLoaded.then(function(texture) {
//      scene.background = texture;
//  });
  scene.background = new THREE.Color(0x000000);
  App.marchingCubes = new MarchingCubes(App);
}


function setupGUI(gui) {

  // more information here: https://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage
  
  // --- CONFIG ---
//   gui.add(App, 'isPaused').onChange(function(value) {
//     App.isPaused = value;
//     if (value) {
//       App.marchingCubes.pause();
//     } else {
//       App.marchingCubes.play();
//     }
//   });

//   gui.add(App.config, 'numMetaballs', 1, 10).onChange(function(value) {
//     App.config.numMetaballs = value;
//     App.marchingCubes.init(App);
//   });

//   // --- DEBUG ---

//   var debugFolder = gui.addFolder('Debug');
//   debugFolder.add(App.marchingCubes, 'showGrid').onChange(function(value) {
//     App.marchingCubes.showGrid = value;
//     if (value) {
//       App.marchingCubes.show();
//     } else {
//       App.marchingCubes.hide();
//     }
//   });

//   debugFolder.add(App.marchingCubes, 'showSpheres').onChange(function(value) {
//     App.marchingCubes.showSpheres = value;
//     if (value) {
//       for (var i = 0; i < App.config.numMetaballs; i++) {
//         App.marchingCubes.balls[i].show();
//       }
//     } else {
//       for (var i = 0; i < App.config.numMetaballs; i++) {
//         App.marchingCubes.balls[i].hide();
//       }
//     }
//   });
//   debugFolder.open();
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);
