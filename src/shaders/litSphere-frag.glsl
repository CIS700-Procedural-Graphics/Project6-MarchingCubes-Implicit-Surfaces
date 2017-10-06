uniform sampler2D texture;
uniform vec3 u_albedo;
uniform vec3 lightPos;

varying vec2 f_uv;

void main() 
{
    gl_FragColor = vec4(texture2D(texture, f_uv).rgb * u_albedo, 1.0);
}