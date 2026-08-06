/**
 * MaskPass - Renders only objects that are in the stencil mask
 */
import { Pass } from './Pass.js';

class MaskPass extends Pass {

	constructor( scene, camera ) {

		super();

		this.scene = scene;
		this.camera = camera;

		this.clear = true;
		this.needsSwap = false;

		this.inverse = false;

	}

	render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

		const context = renderer.getContext();
		const state = renderer.state;

		// don't update color or depth

		state.buffers.color.setMask( false );
		state.buffers.depth.setMask( false );

		// lock buffers

		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );

		// set up stencil

		let writeValue, clearValue;

		if ( this.inverse ) {

			writeValue = 0;
			clearValue = 1;

		} else {

			writeValue = 1;
			clearValue = 0;

		}

		state.buffers.stencil.setTest( true );
		state.buffers.stencil.setOp( context.REPLACE, context.REPLACE, context.REPLACE );
		state.buffers.stencil.setClear( clearValue );
		state.buffers.stencil.setFunc( context.ALWAYS, writeValue, 0xffffffff );

		// draw into the stencil buffer

		renderer.setRenderTarget( readBuffer );
		if ( this.clear ) renderer.clear();
		renderer.render( this.scene, this.camera );

		renderer.setRenderTarget( writeBuffer );
		if ( this.clear ) renderer.clear();
		renderer.render( this.scene, this.camera );

		// unlock buffers

		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );

		// restore color and depth state and force enable

		state.buffers.color.setMask( true );
		state.buffers.depth.setMask( true );
		state.buffers.stencil.setTest( false );
		state.buffers.stencil.setUndefined( undefined );

	}

}

class ClearMaskPass extends Pass {

	constructor() {

		super();

		this.enabled = true;
		this.clear = true;
		this.needsSwap = false;
		this.inverse = false;

	}

	render( renderer /*, writeBuffer, readBuffer, deltaTime, maskActive */ ) {

		renderer.state.buffers.stencil.setTest( false );
		renderer.state.buffers.stencil.setUndefined( undefined );

	}

}

export { MaskPass, ClearMaskPass };
