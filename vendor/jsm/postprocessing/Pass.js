/**
 * Pass - Base class for all post-processing passes
 */
import * as THREE from 'three';

class Pass {

	constructor() {

		this.enabled = true;
		this.needsSwap = true;
		this.clear = false;
		this.renderToScreen = false;

	}

	setSize( /* width, height */ ) {}

	render( /* renderer, writeBuffer, readBuffer, deltaTime, maskActive */ ) {

		console.error( 'Pass: .render() must be implemented in derived class.' );

	}

	dispose() {}

}

class FullScreenQuad {

	constructor( material ) {

		this._mesh = new THREE.Mesh(
			new THREE.PlaneGeometry( 2, 2 ),
			material || new THREE.MeshBasicMaterial()
		);
		this._mesh.frustumCulled = false;

	}

	render( renderer ) {

		renderer.render( this._mesh, _camera );

	}

	dispose() {

		this._mesh.geometry.dispose();
		if ( this._mesh.material.dispose ) this._mesh.material.dispose();

	}

	get material() { return this._mesh.material; }
	set material( v ) { this._mesh.material = v; }

}

const _camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );

export { Pass, FullScreenQuad };
