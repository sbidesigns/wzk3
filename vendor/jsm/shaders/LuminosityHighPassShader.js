/**
 * LuminosityHighPass Shader - Used by UnrealBloomPass
 */

const LuminosityHighPassShader = {

	name: 'LuminosityHighPassShader',

	shaderID: 'luminosityHighPass',

	uniforms: {

		'tDiffuse': { value: null },
		'luminosityThreshold': { value: 1.0 },
		'smoothWidth': { value: 1.0 },
		'defaultOpacity': { value: 1.0 },
		'defaultColor': { value: new THREE.Color( 0xffffff ) }

	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		uniform sampler2D tDiffuse;
		uniform float luminosityThreshold;
		uniform float smoothWidth;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float luma = dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) );

			vec4 outputColor = vec4( defaultColor, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, luma );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`

};

import * as THREE from 'three';
export { LuminosityHighPassShader };
