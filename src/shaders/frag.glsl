
uniform vec3 u_color;
uniform vec3 u_ambient;
uniform vec3 u_lightPos;
uniform vec3 u_lightCol;

varying vec3 f_position;
varying vec3 f_normal;

void main() {
    vec4 color = vec4(u_color, 1.0);

    float d = clamp(dot(f_normal, normalize(u_lightPos - f_position)), 0.0, 1.0);
    gl_FragColor = vec4(d * color.rgb * u_lightCol + 0.2 * u_ambient, 1.0);
}
