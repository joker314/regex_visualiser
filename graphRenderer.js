/**
 * Can be used to render arbitrary graphs using a force-directed technique
 */

class GraphDrawingEngine {
	// TODO: decide whether to use a queue or callback for I/O
	constructor (canvasElement, graphNodes) {
		this.canvasElement = canvasElement
		this.context2d = canvasElement.getContext("2d")
		this.graphNodes = graphNodes
	}
}
