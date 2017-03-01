uniform vec3 u_albedo;

varying vec3 f_position;
varying vec3 f_normal;
varying vec2 f_uv;

void main() {
    vec4 color = vec4(u_albedo, 1.0);

    /*
    //lambert
    float d = clamp(dot(f_normal, normalize(u_lightPos - f_position)), 0.0, 1.0);
    color = vec4(d * color.rgb * u_lightCol * u_lightIntensity, 1.0);
    */

    vec3 lookVector = normalize(f_position - cameraPosition);
    float angle = dot(lookVector, f_normal);
    float r = abs(cos(3.0*angle + 1.0));
    float g = abs(cos(3.0*angle + 2.0));
    float b = abs(cos(3.0*angle + 3.0));
    gl_FragColor = vec4(r, g, b, 0.0);
}