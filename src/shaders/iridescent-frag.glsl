uniform vec3 metaball_color;

varying vec3 f_position; //point in the scene
varying vec3 f_normal; //normal of the same point
varying vec3 camP; //camera position

void main()
{
    vec4 color = vec4(metaball_color, 1.0);

    float t = clamp(dot(f_normal, normalize(camP - f_position)), 0.0, 1.0);

    //color pallete
    //condenses 3 color dimensions into a single dimensional quantity
    float red = 0.5 + 0.5*(cos(6.28*(t)));
    float green = 0.5 + 0.5*(cos(6.28*(t+0.33)));
    float blue = 0.5 + 0.5*(cos(6.28*(t+0.67)));

    vec3 iridescent_color = vec3(red, green, blue);

    vec3 ambient = vec3(0.5, 0.5, 0.5);
    vec3 lightIntensity = vec3(2.0, 2.0, 2.0);
    vec3 lightColor = vec3(1.0, 1.0, 1.0);

    gl_FragColor = vec4(t * iridescent_color * lightColor * lightIntensity + ambient * metaball_color, 1.0);
}
