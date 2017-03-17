require('file-loader?name=[name].[ext]!../index.html');

// Credit:
// http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
// http://paulbourke.net/geometry/polygonise/

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much
const OBJLoader = require('three-obj-loader')(THREE)

import Framework from './framework'
import LUT from './marching_cube_LUT.js'
import MarchingCubes from './marching_cubes.js'

const DEFAULT_VISUAL_DEBUG = false;
const DEFAULT_ISO_LEVEL = 1.0;
const DEFAULT_GRID_RES = 40;
const DEFAULT_GRID_WIDTH = 15;
const DEFAULT_NUM_METABALLS = 7;
const DEFAULT_MIN_RADIUS = 0.7;
const DEFAULT_MAX_RADIUS = 1.2;
const DEFAULT_MAX_SPEED = 0.05;

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

  var {scene, camera, renderer, gui, stats} = framework;
  App.scene = scene;
  App.camera = camera;
  App.renderer = renderer;

  renderer.alpha = true;
  //renderer.setClearColor( 0xbfd1e5 );
  //scene.add(new THREE.AxisHelper(20));

  setupCamera(App.camera);
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

function setupCamera(camera) {
  // set camera position
  camera.position.set(5, 5, 40);
  //make sure to set controls.target.set() in framework too
  camera.lookAt(new THREE.Vector3(DEFAULT_GRID_WIDTH/2.0, DEFAULT_GRID_WIDTH/3.0, DEFAULT_GRID_WIDTH/2.0));
}

function setupLights(scene) {

  // Directional light
  var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
  directionalLight.color.setHSL(0.1, 1, 0.95);
  directionalLight.position.set(1, 10, 2);
  directionalLight.position.multiplyScalar(10);
  scene.add(directionalLight);

  var ambientLight = new THREE.AmbientLight( 0xffffff, 0.3);
  scene.add(ambientLight);
}

function setupScene(scene) {
  App.marchingCubes = new MarchingCubes(App);

  //lamp base loading
  var objLoader = new THREE.OBJLoader();
  objLoader.load('../src/assets/LampBaseLarge.obj', function(obj) {
    var geo = obj.children[0].geometry;

    var material2 = new THREE.ShaderMaterial( {
      uniforms: { 
        tMatCap: { 
            type: 't', 
            value: THREE.ImageUtils.loadTexture( '../src/assets/Mudbox/LiquidMetal.png' ) 
        }
      },
    
      vertexShader: require('./shaders/litsphere-vert.glsl'),
      fragmentShader: require('./shaders/litsphere-frag.glsl'),
      shading: THREE.SmoothShading
    });

    var mesh = new THREE.Mesh(geo, material2);
    mesh.geometry.translate(DEFAULT_GRID_WIDTH/2.0 , 0, DEFAULT_GRID_WIDTH/2.0);
    scene.add(mesh);
  });

  //lamp transparent glass loading
  objLoader.load('../src/assets/LampGlassLarge.obj', function(obj) {
    var geo = obj.children[0].geometry;
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    mesh.material.metalness = 1.0;
    mesh.material.roughness = 0.1;
    mesh.material.transparent = true;
    mesh.material.opacity = 0.1;
    mesh.geometry.translate(DEFAULT_GRID_WIDTH/2.0, 0, DEFAULT_GRID_WIDTH/2.0);
    scene.add(mesh);
  });

}


function setupGUI(gui) {

  // more information here: https://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage
  /*
  // --- CONFIG ---
  gui.add(App, 'isPaused').onChange(function(value) {
    App.isPaused = value;
    if (value) {
      App.marchingCubes.pause();
    } else {
      App.marchingCubes.play();
    }
  });

  gui.add(App.config, 'numMetaballs', 1, 10).onChange(function(value) {
    App.config.numMetaballs = value;
    App.marchingCubes.init(App);
  });

  // --- DEBUG ---

  var debugFolder = gui.addFolder('Debug');
  debugFolder.add(App.marchingCubes, 'showGrid').onChange(function(value) {
    App.marchingCubes.showGrid = value;
    if (value) {
      App.marchingCubes.show();
    } else {
      App.marchingCubes.hide();
    }
  });

  debugFolder.add(App.marchingCubes, 'showSpheres').onChange(function(value) {
    App.marchingCubes.showSpheres = value;
    if (value) {
      for (var i = 0; i < App.config.numMetaballs; i++) {
        App.marchingCubes.balls[i].show();
      }
    } else {
      for (var i = 0; i < App.config.numMetaballs; i++) {
        App.marchingCubes.balls[i].hide();
      }
    }
  });
  debugFolder.open();  
  */
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);
