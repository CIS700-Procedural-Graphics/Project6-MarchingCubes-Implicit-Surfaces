varying vec3 f_position;
varying vec3 f_normal;
varying vec2 f_uv;
varying vec3 cameraPos;

void main() {

    float d = dot(f_normal, normalize(cameraPos - f_position));
    
    //Create a color palette using cosines
    //http://www.iquilezles.org/www/articles/palettes/palettes.htm
    float cosineRedComponent = 0.5 + 0.5 * cos(6.28318 * (2.0 * d + 0.5));
    float cosineGreenComponent = 0.5 + 0.5 * cos(6.28318 * (d + 0.2));
    float cosineBlueComponent = 0.5 + 0.5 * cos(6.28318 * (0.25));
    
    vec3 color = vec3(cosineRedComponent, cosineGreenComponent, cosineBlueComponent);

    gl_FragColor = vec4(-d * color.rgb, 1.0);
}