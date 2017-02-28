
uniform sampler2D texture;
uniform sampler2D matTexture;

varying vec3 f_position;
varying vec3 f_normal;
varying vec2 f_uv;
varying vec2 v_n;

void main() {
    vec3 color = texture2D(matTexture, v_n).rgb;
    gl_FragColor = vec4(color, 1.0);

}
