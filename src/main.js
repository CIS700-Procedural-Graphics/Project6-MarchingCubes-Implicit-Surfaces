require('file-loader?name=[name].[ext]!../index.html');

// Credit:
// http://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/
// http://paulbourke.net/geometry/polygonise/

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much

//import * as Shaders from './shaders'
//export {Iridescent} from './iridescent'

import Framework from './framework'
import LUT from './marching_cube_LUT.js'
import MarchingCubes from './marching_cubes.js'

const DEFAULT_VISUAL_DEBUG = false;
const DEFAULT_ISO_LEVEL = 0.8;//1.0;
const DEFAULT_GRID_RES = 30;
const DEFAULT_GRID_WIDTH = 10;
const DEFAULT_NUM_METABALLS = 10;
const DEFAULT_MIN_RADIUS = 0.5;
const DEFAULT_MAX_RADIUS = 1;
const DEFAULT_MAX_SPEED = 0.03;

var options = {
    Iridescent: true,

    lightColor: '#ffffff',
    lightIntensity: 2,
    albedo: '#dddddd',
    ambient: '#111111',
    useTexture: true,

    Repeat: 1.0,

    RedYShift: -1.0,
    RedAmplitude: 0.5,
    RedFrequency: 1.0,
    RedPhase: -1.0,

    GreenYShift: 0.0,
    GreenAmplitude: 0.5,
    GreenFrequency: 1.0,
    GreenPhase: 1.0,

    BlueYShift: 1.0,
    BlueAmplitude: 0.5,
    BlueFrequency: 1.0,
    BluePhase: 0.66
}

export var matselect = true;
export var iriMaterial = new THREE.ShaderMaterial({
    uniforms: {
        texture: {
            type: "t",
            value: null
        },
        // u_useTexture: {
        //     type: 'i',
        //     value: options.useTexture
        // },
        u_albedo: {
            type: 'v3',
            value: new THREE.Color(options.albedo)
        },
        u_ambient: {
            type: 'v3',
            value: new THREE.Color(options.ambient)
        },
        u_lightPos: {
            type: 'v3',
            value: new THREE.Vector3(30, 50, 40)
        },
        u_lightCol: {
            type: 'v3',
            value: new THREE.Color(options.lightColor)
        },
        u_lightIntensity: {
            type: 'f',
            value: options.lightIntensity
        },
        u_repeat: {
            type: 'f',
            value: options.Repeat
        },
        u_red: {
            type: 'v4',
            value: new THREE.Vector4(-1.0, 0.5, 1.0, -1.0)
        },
        u_green: {
            type: 'v4',
            value: new THREE.Vector4(0.0, 0.5, 1.0, 1.0)
        },
        u_blue: {
            type: 'v4',
            value: new THREE.Vector4(0.0, 0.5, 1.0, 0.66)
        }
    },
    vertexShader: require('./glsl/iridescent-vert.glsl'),
    fragmentShader: require('./glsl/iridescent-frag.glsl')
  });

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

  renderer.setClearColor( 0x2a4260 );
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
  camera.position.set(5, 5, 10);
  camera.lookAt(new THREE.Vector3(5,5,5));
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
    App.scene.children.forEach(function(object){
        App.scene.remove(object);
    });
    setupLights(App.scene);
    setupScene(App.scene);
    App.marchingCubes.init(App);
  });

  // gui.add(App.config, 'gridRes', 1, 50).onChange(function(value) {
  //   App.config.gridRes = value;
  //   App.scene.children.forEach(function(object){
  //       App.scene.remove(object);
  //   });
  //   setupLights(App.scene);
  //   setupScene(App.scene);
  //   App.marchingCubes.init(App);
  // });

  gui.add(App.config, 'isolevel', 0.0, 2.0).onChange(function(value) {
    App.config.isolevel = value;
    App.scene.children.forEach(function(object){
        App.scene.remove(object);
    });
    setupLights(App.scene);
    setupScene(App.scene);

     App.marchingCubes.init(App);
  });

  gui.add(App.config, 'maxSpeed', 0.01, 0.2).onChange(function(value) {
    App.config.maxSpeed = value;
    App.scene.children.forEach(function(object){
        App.scene.remove(object);
    });
    setupLights(App.scene);
    setupScene(App.scene);
    App.marchingCubes.init(App);
  });

  /////



  var shading = gui.addFolder('Shader Controls');

  shading.add(options, 'Iridescent').onChange(function(val) {
      matselect=val;
  });
  shading.add(options, 'Repeat', 1.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_repeat.value = val;
  });
  shading.add(options, 'RedYShift', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_red.value.x = val;
  });
  shading.add(options, 'RedAmplitude', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_red.value.y = val;
  });
  shading.add(options, 'RedFrequency', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_red.value.z = val;
  });
  shading.add(options, 'RedPhase', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_red.value.w = val;
  });
  shading.add(options, 'GreenYShift', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_green.value.x = val;
  });
  shading.add(options, 'GreenAmplitude', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_green.value.y = val;
  });
  shading.add(options, 'GreenFrequency', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_green.value.z = val;
  });
  shading.add(options, 'GreenPhase', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_green.value.w = val;
  });
  shading.add(options, 'BlueYShift', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_blue.value.x = val;
  });
  shading.add(options, 'BlueAmplitude', -2.0, 2.0).onChange(function(val) {
      iriMaterial.uniforms.u_blue.value.y = val;
  });
  shading.add(options, 'BlueFrequency').onChange(function(val) {
      iriMaterial.uniforms.u_blue.value.z = val;
  });
  shading.add(options, 'BluePhase').onChange(function(val) {
      iriMaterial.uniforms.u_blue.value.w = val;
  });
  shading.addColor(options, 'lightColor').onChange(function(val) {
      iriMaterial.uniforms.u_lightCol.value = new THREE.Color(val);
  });
  shading.add(options, 'lightIntensity').onChange(function(val) {
      iriMaterial.uniforms.u_lightIntensity.value = val;
  });
  shading.addColor(options, 'albedo').onChange(function(val) {
      iriMaterial.uniforms.u_albedo.value = new THREE.Color(val);
  });
  shading.addColor(options, 'ambient').onChange(function(val) {
      iriMaterial.uniforms.u_ambient.value = new THREE.Color(val);
  });


  // gui.add(options, 'useTexture').onChange(function(val) {
  //     iriMaterial.uniforms.u_useTexture.value = val;
  // });



  //////

  // --- DEBUG ---
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
  debugFolder.close();
  */
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);
