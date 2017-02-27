uniform sampler2D texture;
uniform vec3 u_ambient;
uniform vec3 u_lightPos;
uniform vec3 u_lightCol;
uniform float u_lightIntensity;

varying vec2 f_uv;
varying vec3 f_normal;
varying vec3 f_position;

void main() {
    float d = clamp(dot(f_normal, normalize(u_lightPos - f_position)), 0.0, 1.0);
    gl_FragColor = vec4(d * u_lightCol * u_lightIntensity + u_ambient * 0.1, 1.0);
    // gl_FragColor = vec4(f_normal, 1.0);
}
