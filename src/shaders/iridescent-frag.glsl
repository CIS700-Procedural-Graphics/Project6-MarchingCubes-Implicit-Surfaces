uniform vec3 metaball_color;
uniform vec3 lightPos;
uniform vec3 camPos;

varying vec3 f_position;
varying vec3 f_normal;
varying vec2 f_uv;

varying vec3 camP;

void main()
{
    vec4 color = vec4(metaball_color, 1.0);

    float t = clamp(dot(f_normal, normalize(camP - f_position)), 0.0, 1.0);

    //color pallete
    float red = 0.5 + 0.5*(cos(6.28*(t)));
    float green = 0.5 + 0.5*(cos(6.28*(t+0.33)));
    float blue = 0.5 + 0.5*(cos(6.28*(t+0.67)));

    vec3 iridescent_color = vec3(red, green, blue);

    vec3 ambient = vec3(0.5, 0.5, 0.5);
    vec3 lightIntensity = vec3(2.0, 2.0, 2.0);
    vec3 lightColor = vec3(1.0, 1.0, 1.0);

    gl_FragColor = vec4(t * iridescent_color * lightColor * lightIntensity + ambient * metaball_color, 1.0);
}
