/**
 * ShaderPass - Applies a shader as a post-processing pass
 */
import { Pass } from './Pass.js';
import * as THREE from 'three';

class ShaderPass extends Pass {

	constructor( shader, textureID ) {

		super();

		this.textureID = ( textureID !== undefined ) ? textureID : 'tDiffuse';

		if ( shader instanceof THREE.ShaderMaterial ) {

			this.uniforms = shader.uniforms;
			this.material = shader;

		} else if ( shader ) {

			this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

			this.material = new THREE.ShaderMaterial( {

				defines: Object.assign( {}, shader.defines ),
				uniforms: this.uniforms,
				vertexShader: shader.vertexShader,
				fragmentShader: shader.fragmentShader

			} );

		}

		this.fsQuad = new FullScreenQuad( this.material );

	}

	render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

		if ( this.uniforms[ this.textureID ] ) {

			this.uniforms[ this.textureID ].value = readBuffer.texture;

		}

		this.fsQuad.material = this.material;

		if ( this.renderToScreen ) {

			renderer.setRenderTarget( null );
			this.fsQuad.render( renderer );

		} else {

			renderer.setRenderTarget( writeBuffer );
			if ( this.clear ) renderer.clear();
			this.fsQuad.render( renderer );

		}

	}

	dispose() {

		this.material.dispose();
		this.fsQuad.dispose();

	}

}

class FullScreenQuad {

	constructor( material ) {

		this._mesh = new THREE.Mesh(
			new THREE.PlaneGeometry( 2, 2 ),
			material
		);
		this._mesh.frustumCulled = false;

	}

	render( renderer ) {

		renderer.render( this._mesh, _camera );

	}

	dispose() {

		this._mesh.geometry.dispose();

	}

}

const _camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );

export { ShaderPass };
