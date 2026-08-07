/**
 * Output Shader - Three.js r160 compatible output shader
 * Uses ShaderMaterial-compatible GLSL (no #version, no explicit in/out)
 * ShaderMaterial auto-prepends #version, precision, and built-in uniforms/attributes.
 */

const OutputShader = {

	name: 'OutputShader',

	uniforms: {

		'tDiffuse': { value: null },
		'toneMappingExposure': { value: 1.0 }

	},

	vertexShader: /* glsl */`

		varying vec2 vUv;
		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}

	`,

	fragmentShader: /* glsl */`

		uniform sampler2D tDiffuse;
		uniform float toneMappingExposure;
		varying vec2 vUv;

		void main() {

			gl_FragColor = vec4( texture2D( tDiffuse, vUv ).rgb, 1.0 );

		}`

};

export { OutputShader };
