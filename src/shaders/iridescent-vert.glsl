varying vec3 f_normal;
varying vec3 f_position;
varying vec3 camP;

void main()
{
    f_normal = normal;
    f_position = position;
    camP = cameraPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
