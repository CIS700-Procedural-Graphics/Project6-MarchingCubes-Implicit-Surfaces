require('file-loader?name=[name].[ext]!../index.html');

// Resources:
// http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
// http://paulbourke.net/geometry/polygonise/

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much

import Framework from './framework'
import LUT from './marching_cube_LUT.js'
import MarchingCubes from './marching_cubes.js'
// import OBJLoader from './OBJLoader.js'

const OBJLoader = require('three-obj-loader');
OBJLoader(THREE);

const DEFAULT_VISUAL_DEBUG = false;
const DEFAULT_ISO_LEVEL = 1.0;
const DEFAULT_GRID_RES = 30;
const DEFAULT_GRID_WIDTH = 10;
const DEFAULT_GRID_HEIGHT = 20;
const DEFAULT_GRID_DEPTH = 10;
const DEFAULT_NUM_METABALLS = 6;
const DEFAULT_MIN_RADIUS = 1.0;
const DEFAULT_MAX_RADIUS = 1.5;
const DEFAULT_MAX_SPEED = 1.0;

//------------------------------------------------------------------------------------------------------------------

// var options = {lightColor: '#ffffff',lightIntensity: 1,ambient: '#111111', albedo: '#110000'};
// var loaded = false;
// var red = new THREE.Color(1.0,0.0,0.0);
// var green = new THREE.Color(0.0,1.0,0.0);
// var glassGeo;
// var lampGeo;

// // glass
// var glass_mat = {
//   uniforms: {
//     u_albedo: {type: 'v3', value: new THREE.Color(options.albedo)},
//     u_ambient: {type: 'v3',value: new THREE.Color(options.ambient)},
//     u_lightCol: {type: 'v3',value: new THREE.Color(options.lightColor)},
//     u_lightIntensity: {type: 'f',value: options.lightIntensity}
//   },
//   vertexShader: require('./shaders/glass-vert.glsl'),
//   fragmentShader: require('./shaders/glass-frag.glsl')
// };

// // metal
// var metal_mat = {
//   uniforms: {
//     u_ambient: {type: 'v3',value: new THREE.Color(options.ambient)},
//     u_lightCol: {type: 'v3',value: new THREE.Color(options.lightColor)},
//     u_lightIntensity: {type: 'f',value: options.lightIntensity}
//   },
//   vertexShader: require('./shaders/metal-vert.glsl'),
//   fragmentShader: require('./shaders/metal-frag.glsl')
// };

//const GLASS_MAT = new THREE.ShaderMaterial(g_mat);
var GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xff0000, transparent: true, opacity: 0.3});
var METAL_MAT = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x111111});

//------------------------------------------------------------------------------------------------------------------

var App = {

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
    gridHeight:      DEFAULT_GRID_HEIGHT,
    gridDepth:      DEFAULT_GRID_DEPTH,

    // Width of each voxel
    // Ideally, we want the voxel to be small (higher resolution)
    gridCellWidth:  DEFAULT_GRID_WIDTH / DEFAULT_GRID_RES,
    gridCellHeight:  DEFAULT_GRID_HEIGHT / DEFAULT_GRID_RES,
    gridCellDepth:  DEFAULT_GRID_DEPTH / DEFAULT_GRID_RES,

    // Number of metaballs
    numMetaballs:   DEFAULT_NUM_METABALLS,

    // Minimum radius of a metaball
    minRadius:      DEFAULT_MIN_RADIUS,

    // Maxium radius of a metaball
    maxRadius:      DEFAULT_MAX_RADIUS,

    // Maximum speed of a metaball
    maxSpeed:       DEFAULT_MAX_SPEED,

    speed: 0.1
  },

  // Scene's framework objects
  camera:           undefined,
  scene:            undefined,
  renderer:         undefined,

  //Position of the Light in the scene; for iridescent shader
  lightPos: new THREE.Vector3(1.0, 10.0, 2.0),

  // Play/pause control for the simulation
  isPaused:         false
};




// called after the scene loads
function onLoad(framework)
{
	var {scene, camera, renderer, gui, stats} = framework;
	App.scene = scene;
	App.camera = camera;
	App.renderer = renderer;

	renderer.setClearColor( 0xbfd1e5 );
	//scene.add(new THREE.AxisHelper(20));
	var objLoader7 = new THREE.OBJLoader();
	objLoader7.load('models/LavaLamp_glass.obj', function(obj)
	{
		console.log("blah00");
	});

  setupCamera(App.camera);
  setupLights(App.scene);
  setupScene(App.scene);
  setupGUI(gui,App.scene);
}

// called on frame updates
function onUpdate(framework)
{
  if (App.marchingCubes)
  {
    App.marchingCubes.update();
  }
}

function setupCamera(camera)
{
  // set camera position
  camera.position.set(15, 10, 15);
  camera.lookAt(new THREE.Vector3(0,10,0));
}

function setupLights(scene)
{
  // Directional light
  var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
  directionalLight.color.setHSL(0.1, 1, 0.95);
  directionalLight.position.set(1, 10, 2);
  directionalLight.position.multiplyScalar(10);

  App.lightPos = directionalLight.position;
  scene.add(directionalLight);
}

function setupScene(scene) 
{
	App.marchingCubes = new MarchingCubes(App);
}

function setupGUI(gui, scene)
{
	// --- CONFIG ---
  	gui.add(App.config, 'numMetaballs', 1, 10).onChange(function(value) {
		cleanscene(scene);
		App.config.numMetaballs = value;
		App.marchingCubes.init(App);
	});

	gui.add(App.config, 'isolevel', 0.5, 2).onChange(function(value) {
		cleanscene(scene);
		App.marchingCubes.init(App);
	});

	gui.add(App.config, 'speed', 0.01, DEFAULT_MAX_SPEED).onChange(function(value) {
		cleanscene(scene);
		App.marchingCubes.init(App);
	});

	gui.add(App, 'isPaused').onChange(function(value) {
		App.isPaused = value;
		if (value) 
		{
			App.marchingCubes.pause();
		} else 
		{
			App.marchingCubes.play();
		}
	});


  // --- DEBUG ---
  //uncomment for debugging purposes
  /*
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

function cleanscene(scene)
{
	//remove all objects from the scene
	for( var i = scene.children.length - 1; i >= 0; i--)
	{
		var obj = scene.children[i];
		scene.remove(obj);
	}
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);
