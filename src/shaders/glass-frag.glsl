#define M_PI 3.1415926535897932384626433832795

uniform vec3 u_lightCol;
uniform float u_lightIntensity;

varying vec3 f_position;
varying vec3 f_normal;
varying vec3 e_position;

float cosine(float a, float b, float c, float d, float t) {
	return a + b * cos(2.0 * M_PI * (c * t + d));
}

void main() {
	float d = clamp(dot(f_normal, normalize(e_position - f_position)), 0.0, 1.0);
	vec3 rgb = mix(vec3(0.4, 0.3, 0.16), vec3(1.0, 0.3, 0.3), d);

  gl_FragColor = vec4(d,d,d, 1.0);
}
