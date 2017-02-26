
// this file is just for convenience. it sets up loading the mario obj and texture

const THREE = require('three');

export var silverTexture = new Promise((resolve, reject) => {
    (new THREE.TextureLoader()).load(require('./assets/silver.bmp'), function(texture) {
        resolve(texture);
    })
})
