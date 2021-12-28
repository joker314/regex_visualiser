/**
 * Can be used to render arbitrary graphs using a force-directed technique
 */

class GraphDrawingEngine {
	// TODO: decide whether to use a queue or callback for I/O
	constructor (canvasElement, graphNodes, graphEdges) {
		this.canvasElement = canvasElement
		this.context2d = canvasElement.getContext("2d")

		this.graphNodes = graphNodes
		this.graphEdges = graphEdges
		this.zoomButtons = new ZoomButtons()

		this.scale = 1 // XXX: decided to manually handle coordinates so as to consistently handle mouse movements
		this.offsetX = 0
		this.offsetY = 0
		this.isRendering = false
		
		this.startRendering() // XXX: could also involve initialisation logic vs just requestAnimationFrame(this.render)
	}

	render (timestamp) {
		this.graphNodes.forEach(node => {
			node.render(this, timestamp)
		})

		this.graphEdges.forEach(edge => {
			edge.render(this, timestamp)
		})

		if (this.isRendering) {
			window.requestAnimationFrame(this.render.bind(this))
		}
	}

	scalePosition (x, y) {
		return [(x + this.offsetX) * this.scale, (y + this.offsetY) * this.scale]
	}

	scaleDistance (r) {
		return r * this.scale
	}

	drawCircle (x, y, r, fillCol) {
		const [newX, newY] = this.scalePosition(x, y)
		const newR = this.scaleDistance(r)
		
		this.context2d.beginPath()
		this.context2d.fillStyle = fillCol
		this.context2d.arc(newX, newY, newR, 0, 2 * Math.PI)
		this.context2d.fill()
	}

	drawLine (startPos, endPos) {
		const [startX, startY] = this.scalePosition(...startPos)
		const [endX, endY] = this.scalePosition(...endPos)

		this.context2d.beginPath()
		this.context2d.strokeStyle = "red"
		this.context2d.moveTo(startX, startY)
		this.context2d.lineTo(endX, endY)
		this.stroke()
	}

	startRendering () {
		this.isRendering = true
		window.requestAnimationFrame(this.render.bind(this))
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

	render (engine, timestamp) {
		engine.drawCircle(this.x, this.y, 30, "orange") 
	}

	onMouseover () {
		
	}

	onMouseout () {

	}
}

class GraphEdge {
	constructor (startNode, endNode) {
		this.startNode = startNode
		this.endNode = endNode
	}

	render (engine, timestamp) {
		engine.drawLine([this.startNode, this.endNode].map(node => [node.x, node.y]))
	}
}

// TODO
class ZoomButtons {

}

