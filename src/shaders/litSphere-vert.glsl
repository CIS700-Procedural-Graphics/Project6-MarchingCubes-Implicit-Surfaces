varying vec2 f_uv;

void main()
{
    vec4 pos = vec4(position, 1.0);
    vec3 dir_camToVertex = normalize(vec3(modelViewMatrix * pos)); //direction vector: camera to vertex position
	
	//normalMatrix is inverse transpose of model view matrix
    vec3 nor = normalize(normalMatrix * normal); //normal in screen space

    vec3 reflected = reflect(dir_camToVertex, nor);
	
	f_uv.x = reflected.x / (2.0 * sqrt(pow(reflected.x, 2.0) + 
								       pow(reflected.y, 2.0) + 
        							   pow(reflected.z + 1.0, 2.0))) + 0.5;
	
	f_uv.y = reflected.y / (2.0 * sqrt(pow(reflected.x, 2.0) + 
								       pow(reflected.y, 2.0) + 
        							   pow(reflected.z + 1.0, 2.0))) + 0.5;

    gl_Position = projectionMatrix * modelViewMatrix * pos;
}