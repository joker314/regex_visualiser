/**
 * Can be used to render arbitrary graphs using a force-directed technique
 */

class GraphDrawingEngine {
	// TODO: decide whether to use a queue or callback for I/O
	constructor (canvasElement, graphNodes) {
		this.canvasElement = canvasElement
		this.context2d = canvasElement.getContext("2d")
		this.graphNodes = graphNodes
		this.scale = 1 // XXX: decided to manually handle coordinates so as to consistently handle mouse movements
		this.offsetX = 0
		this.offsetY = 0
	}
}

/**
 * Represents a node
 */
class GraphNode {
	constructor (x, y) {
		this.x = x
		this.y = y
	}

	render (engine) {
		/**
		 * Called by the rendering engine so that the node can display itself
		 */
	}

	onMouseover () {
		
	}

	onMouseout () {

	}
}
