uniform vec3 u_lightCol;
uniform float u_lightIntensity;

varying vec3 f_position;
varying vec3 f_normal;
varying vec3 cam_position;

void main() 
{
    float d = clamp(dot(f_normal, normalize(cam_position - f_position)), 0.0, 1.0);

    gl_FragColor = vec4(d,d,d, 1.0);
}