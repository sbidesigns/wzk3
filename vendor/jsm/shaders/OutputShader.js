/**
 * Output Shader - Three.js r160 compatible output shader for RawShaderMaterial
 * Includes proper GLSL 300 es declarations (precision, uniforms, attributes)
 */

const OutputShader = {

	name: 'OutputShader',

	uniforms: {

		'tDiffuse': { value: null },
		'toneMappingExposure': { value: 1.0 }

	},

	vertexShader: /* glsl */`

		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		in vec3 position;
		in vec2 uv;

		out vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		precision highp float;

		uniform sampler2D tDiffuse;
		uniform float toneMappingExposure;

		in vec2 vUv;

		out vec4 fragColor;

		void main() {

			fragColor = vec4( texture( tDiffuse, vUv ).rgb, 1.0 );

		}`

};

export { OutputShader };
