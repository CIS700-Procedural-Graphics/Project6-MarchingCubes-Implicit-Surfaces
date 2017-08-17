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
const DEFAULT_ISO_LEVEL = 1.3;
const DEFAULT_GRID_RES = 30;
const DEFAULT_GRID_WIDTH = 10;
const DEFAULT_GRID_HEIGHT = 20;
const DEFAULT_GRID_DEPTH = 10;
const DEFAULT_NUM_METABALLS = 6;
const DEFAULT_MIN_RADIUS = 1.3;
const DEFAULT_MAX_RADIUS = 1.8;
const DEFAULT_MAX_SPEED = 1.0;

//------------------------------------------------------------------------------------------------------------------
var lavalamp_metalGeo;
var metal_mat = new THREE.MeshStandardMaterial({ 
	color: 0xBCC6CC,
	emissive: 0xffffff,
	emissiveIntensity: 0.5,
    metalness: 1,
    roughness: 0.4
});
var lampmetal;

var lavalamp_glassGeo;
var glass_mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xd447ff, transparent: true, opacity: 0.3});
var lampglass;

//------------------------------------------------------------------------------------------------------------------

var iridescent_Material = new THREE.ShaderMaterial({
  uniforms: {
    metaball_color:
    {
        type: "v3",
        value: new THREE.Color(0x2194ce)
    },
    lightPos:
    {
        type: "v3",
        value: new THREE.Vector3(1.0, 10.0, 2.0)
    }
  },
  vertexShader: require('./shaders/iridescent-vert.glsl'),
  fragmentShader: require('./shaders/iridescent-frag.glsl')
});

var litSphere_Material = new THREE.ShaderMaterial({
  uniforms: {
	texture: {
		type: "t", 
		value: THREE.ImageUtils.loadTexture(require('./assets/textures/Silver.bmp'))
	},
	u_albedo: {
	    type: 'v3',
	    value: new THREE.Vector3(0.867, 0.867, 0.867)
	},
	lightPos: {
	    type: 'v3',
	    value: new THREE.Vector3(1.0, 10.0, 2.0)
	}
  },
  vertexShader: require('./shaders/litSphere-vert.glsl'),
  fragmentShader: require('./shaders/litSphere-frag.glsl')
});


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

		//actual speed of metaballs
		speed: 0.1,

		//material used by metaballs
		material: iridescent_Material
	},

	// Scene's framework objects
	camera:           undefined,
	scene:            undefined,
	renderer:         undefined,

	//Position of the Light in the scene; for iridescent shader
	lightPos: new THREE.Vector3(1.0, 10.0, 2.0),

	// Play/pause control for the simulation
	isPaused:         false,
	Scenario:         1,
	Shader:           1,
	LitSphereTexture: 1
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

	LoadLavaLamp(App.scene);

	setupCamera(App.camera);
	setupLights(App.scene);
	setupScene(App.scene);
	setupGUI(gui, App.scene);
}

// called on frame updates
function onUpdate(framework)
{
  if (App.marchingCubes)
  {
    App.marchingCubes.update();
  }
}

function LoadLavaLamp(scene)
{
	var objLoader = new THREE.OBJLoader();

	var obj = objLoader.load(require('./assets/models/LavaLamp_metal.obj'), function(obj) {
		lavalamp_metalGeo = obj.children[0].geometry;
		lampmetal = new THREE.Mesh(lavalamp_metalGeo, metal_mat);
		lampmetal.position.set(DEFAULT_GRID_WIDTH*0.5,-7,DEFAULT_GRID_DEPTH*0.5);
		lampmetal.scale.set(3.8,3.5,3.8);
		scene.add(lampmetal);
	});

	var obj = objLoader.load(require('./assets/models/LavaLamp_glass.obj'), function(obj) {
		lavalamp_glassGeo = obj.children[0].geometry;
		lampglass = new THREE.Mesh(lavalamp_glassGeo, glass_mat);
		lampglass.position.set(DEFAULT_GRID_WIDTH*0.5,-7,DEFAULT_GRID_DEPTH*0.5);
		lampglass.scale.set(3.8,3.5,3.8);
		scene.add(lampglass);
	});
}

function setupCamera(camera)
{
	// set camera position
	camera.position.set(25, 8, 25);
	camera.lookAt(new THREE.Vector3(0,8,0));
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
	gui.add(App.config, 'isolevel', 0.5, 2).name("IsoLevel").onChange(function(value) {
		onreset(App.scene);
	});
	// gui.add(App.config, 'gridRes', 30, 70).name("Grid Resolution").step(1).onChange(function(value) {
	// 	onreset(App.scene);
	// });

	gui.add(App.config, 'numMetaballs', 1, 10).name("Number of Metaballs").step(1).onChange(function(value) {
		onreset(App.scene);
	});
	gui.add(App.config, 'speed', 0.01, DEFAULT_MAX_SPEED).name("Speed").onChange(function(value) {
		onreset(App.scene);
	});

	gui.add(App, 'Shader', { Iridescent: 1, LitSphere: 2 } ).onChange(function(value){
		onreset(App.scene);
	});

	gui.add(App, 'LitSphereTexture', { Green: 1, Gold: 2, Silver: 3, Flame: 4, Lights: 5, Brown: 6, Normal: 7} ).name("LitSphere Texture").onChange(function(value){
		App.Shader = 2;
		if(value==1)
		{
			litSphere_Material.uniforms.texture.value = THREE.ImageUtils.loadTexture(require('./assets/textures/Green.bmp'));
		}
		else if(value==2)
		{
			litSphere_Material.uniforms.texture.value = THREE.ImageUtils.loadTexture(require('./assets/textures/Gold.bmp'));
		}
		else if(value==3)
		{
			litSphere_Material.uniforms.texture.value = THREE.ImageUtils.loadTexture(require('./assets/textures/Silver.bmp'));
		}
		else if(value==4)
		{
			litSphere_Material.uniforms.texture.value = THREE.ImageUtils.loadTexture(require('./assets/textures/Flame.bmp'));
		}
		else if(value==5)
		{
			litSphere_Material.uniforms.texture.value = THREE.ImageUtils.loadTexture(require('./assets/textures/Lights.bmp'));
		}
		else if(value==6)
		{
			litSphere_Material.uniforms.texture.value = THREE.ImageUtils.loadTexture(require('./assets/textures/Brown.bmp'));
		}
		else
		{
			litSphere_Material.uniforms.texture.value = THREE.ImageUtils.loadTexture(require('./assets/textures/Normal.bmp'));
		}

		onreset(App.scene);
	});

	gui.add(App, 'Scenario', { Lavalamp: 1, Metaballs: 2 } ).onChange(function(value){
		onreset(App.scene);
	});

	gui.add(App, 'isPaused').name("Pause").onChange(function(value) {
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
		if (value) 
		{
			App.marchingCubes.show();
		} 
		else 
		{
			App.marchingCubes.hide();
		}
	});

	debugFolder.add(App.marchingCubes, 'showSpheres').onChange(function(value) {
		App.marchingCubes.showSpheres = value;
		if (value) 
		{
			for (var i = 0; i < App.config.numMetaballs; i++) 
			{
				App.marchingCubes.balls[i].show();
			}
		} 
		else 
		{
			for (var i = 0; i < App.config.numMetaballs; i++) 
			{
				App.marchingCubes.balls[i].hide();
			}
		}
	});
	debugFolder.open();
	*/
}

function onreset(scene)
{
	cleanscene(scene);
	setupLights(App.scene);
	
	if(App.Shader == 1)
	{
		App.config.material = iridescent_Material;
	}
	else
	{
		App.config.material = litSphere_Material;
	}

	if(App.Scenario == 1)
	{
		scene.add(lampmetal);
		scene.add(lampglass);
		App.renderer.setClearColor( 0xbfd1e5 );
		// set camera position
		App.camera.position.set(25, 8, 25);
		App.camera.lookAt(new THREE.Vector3(0,8,0));
	}
	else
	{
		App.renderer.setClearColor( 0x000 );
		// set camera position
		App.camera.position.set(18, 10, 18);
		App.camera.lookAt(new THREE.Vector3(0,10,0));
	}

	App.marchingCubes.init(App);
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
