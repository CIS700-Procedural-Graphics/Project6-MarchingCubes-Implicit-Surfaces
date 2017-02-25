require('file-loader?name=[name].[ext]!../index.html');

// Credit:
// http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
// http://paulbourke.net/geometry/polygonise/

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much
const OBJLoader = require('three-obj-loader');
OBJLoader(THREE)

import Framework from './framework'
import LUT from './marching_cube_LUT.js'
import MarchingCubes from './marching_cubes.js'

const DEFAULT_VISUAL_DEBUG = false;
const DEFAULT_ISO_LEVEL = 1.0;
const DEFAULT_GRID_RES = 30;
const DEFAULT_GRID_WIDTH = 6;
const DEFAULT_GRID_HEIGHT = 17;
const DEFAULT_GRID_DEPTH = 6;
const DEFAULT_NUM_METABALLS = 10;
const DEFAULT_MIN_RADIUS = 0.5;
const DEFAULT_MAX_RADIUS = 1;
const DEFAULT_MAX_SPEEDX = 0.005;
const DEFAULT_MAX_SPEEDY = 0.03;

var options = {lightColor: '#ffffff',lightIntensity: 1,ambient: '#111111', albedo: '#110000'};
var loaded = false;
var red = new THREE.Color(1.0,0.0,0.0);
var green = new THREE.Color(0.0,1.0,0.0);
var glassGeo;
var lampGeo;

// glass, emissive, iridescent
var g_mat = {
  uniforms: {
    u_albedo: {type: 'v3', value: new THREE.Color(options.albedo)},
    u_ambient: {type: 'v3',value: new THREE.Color(options.ambient)},
    u_lightCol: {type: 'v3',value: new THREE.Color(options.lightColor)},
    u_lightIntensity: {type: 'f',value: options.lightIntensity}
  },
  vertexShader: require('./shaders/glass-vert.glsl'),
  fragmentShader: require('./shaders/glass-frag.glsl')
};

// metal
var m_mat = {
  uniforms: {
    u_ambient: {type: 'v3',value: new THREE.Color(options.ambient)},
    u_lightCol: {type: 'v3',value: new THREE.Color(options.lightColor)},
    u_lightIntensity: {type: 'f',value: options.lightIntensity}
  },
  vertexShader: require('./shaders/metal-vert.glsl'),
  fragmentShader: require('./shaders/metal-frag.glsl')
};

//const GLASS_MAT = new THREE.ShaderMaterial(g_mat);
var GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xff0000, transparent: true, opacity: 0.3});
var METAL_MAT = new THREE.MeshPhongMaterial({ color: 0xffffff});

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

    gridHeight:     DEFAULT_GRID_HEIGHT,

    gridDepth:      DEFAULT_GRID_DEPTH,

    // Width of each voxel
    // Ideally, we want the voxel to be small (higher resolution)
    gridCellWidth:  DEFAULT_GRID_WIDTH / DEFAULT_GRID_RES,
    gridCellHeight: DEFAULT_GRID_HEIGHT / DEFAULT_GRID_RES,
    gridCellDepth:  DEFAULT_GRID_DEPTH / DEFAULT_GRID_RES,

    // Number of metaballs
    numMetaballs:   DEFAULT_NUM_METABALLS,

    // Minimum radius of a metaball
    minRadius:      DEFAULT_MIN_RADIUS,

    // Maxium radius of a metaball
    maxRadius:      DEFAULT_MAX_RADIUS,

    // Maximum speed of a metaball
    maxSpeedX:       DEFAULT_MAX_SPEEDX,
    maxSpeedY:       DEFAULT_MAX_SPEEDY,
    maxSpeedZ:       DEFAULT_MAX_SPEEDX,          
  },

  // Scene's framework objects
  camera:           undefined,
  scene:            undefined,
  renderer:         undefined,

  // Play/pause control for the simulation
  isPaused:         false,
  color:            0xffffff
};

// called after the scene loads
function onLoad(framework) {

  var {scene, camera, renderer, gui, stats} = framework;
  App.scene = scene;
  App.camera = camera;
  App.renderer = renderer;

  renderer.setClearColor( 0x111111 );
  //scene.add(new THREE.AxisHelper(20));

  var objLoader = new THREE.OBJLoader();
  var obj = objLoader.load('glass.obj', function(obj) {
    glassGeo = obj.children[0].geometry;
    var glass = new THREE.Mesh(glassGeo, GLASS_MAT);
    glass.translateX(-1.5);
    glass.translateZ(-1.5);
    App.scene.add(glass);
    loaded = true;
  });

  var obj = objLoader.load('lamp.obj', function(obj) {
    lampGeo = obj.children[0].geometry;
    var lamp = new THREE.Mesh(lampGeo, METAL_MAT);
    lamp.translateX(-1.5);
    lamp.translateZ(-1.5);
    App.scene.add(lamp);
  });

  setupCamera(App.camera);
  setupLights(App.scene);
  setupScene(App.scene);
  setupGUI(gui);
}

function cosine(a,b,c,d,t) {
  return a + b * Math.cos(2.0 * Math.PI * (c * t + d));
}

// called on frame updates
function onUpdate(framework) {
  if (loaded) {
    var date = new Date();
    var sec = date.getSeconds();
    var r = cosine(0.5, 0.5, 1.0, 0.0, sec/60.0);
    var g = cosine(0.5, 0.5, 1.0, 0.33, sec/60.0);
    var b = cosine(0.5, 0.5, 1.0, 0.67, sec/60.0); 
    GLASS_MAT.emissive.set(new THREE.Color(r,g,b));
  }
  if (App.marchingCubes) {
    App.marchingCubes.update();
  }
}

function setupCamera(camera) {
  // set camera position
  camera.position.set(-5, 5, -30);
  camera.lookAt(new THREE.Vector3(0,0,0));
}

function setupLights(scene) {

  // Directional light
  var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
  directionalLight.color.setHSL(0.1, 1, 0.95);
  directionalLight.position.set(1, 10, 2);
  directionalLight.position.multiplyScalar(10);

  scene.add(directionalLight);
}

function setupScene(scene) {
  App.marchingCubes = new MarchingCubes(App);
}

function setupGUI(gui) {

  // more information here: https://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage

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
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);
