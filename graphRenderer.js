// TODO: move to a util Function
function average(a, b) {
	return (a + b) / 2
}

/**
 * Can be used to render arbitrary graphs using a force-directed technique
 */

export class GraphDrawingEngine {
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
		this.context2d.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)

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
	
	drawOffsetCurve (startPos, endPos, verticalOffset, horizontalOffset) {
		const [startX, startY] = this.scalePosition(...startPos)
		const [endX, endY] = this.scalePosition(...endPos)
		
		// Create a blueprint from which to draw the two control points
		const offsetControlPoint = [average(startX, endX), average(startY, endY) + verticalOffset]
		
		// Clone them so that they can be mutated independently of each other
		const controlA = Array.from(offsetControlPoint)
		const controlB = Array.from(offsetControlPoint)
		
		// Increment one and decrement the other ever so slightly, so as to make self-loops more obvious
		//controlA[0] -= horizontalOffset
		//controlB[0] += horizontalOffset
		
		this.context2d.beginPath()
		this.context2d.strokeStyle = "red"
		this.context2d.moveTo(startX, startY)
		
		// Using the same control point twice reduces to a quadratic Bezier curve
		// TODO: include proof in documented design?
		this.context2d.bezierCurveTo(...offsetControlPoint, ...offsetControlPoint, endX, endY)
		this.context2d.stroke()
	}
	
	drawLine (startPos, endPos) {
		this.drawOffsetCurve(startPos, endPos, 0)
	}
	
	drawHalfCircle (startPos, endPos) {
		
	}
	
	drawUpwardCurve (startPos, endPos) {
		const extraHeight = Math.max(0, Math.abs(endPos[0] - startPos[0]) - 30) / 8
		const extraWidth = startPos[0] === endPos[0] ? 3 : 0
		
		console.log("Extra height", extraHeight)
		return this.drawOffsetCurve(startPos, endPos, 10 + extraHeight + extraWidth, extraWidth)
	}
	
	drawDownwardCurve (startPos, endPos) {
		const extraHeight = Math.max(0, Math.abs(endPos[0] - startPos[0]) - 30) / 8
		const extraWidth = startPos[0] === endPos[0] ? 3 : 0
		
		console.log("Extra height", extraHeight)
		return this.drawOffsetCurve(startPos, endPos, -10 - extraHeight - extraWidth, extraWidth)
	}
	
	// TODO: scale the font width e.g. binary search?
	drawText (x, y, fontSize, text) {
		this.context2d.fillStyle = "blue"
		this.context2d.font = fontSize + "px Consolas"
		this.context2d.textAlign = "center"
		this.context2d.fillText(text, ...this.scalePosition(x, y))
	}

	startRendering () {
		this.isRendering = true
		window.requestAnimationFrame(this.render.bind(this))
	}
}

/**
 * Represents a node
 */
export class GraphNode {
	constructor (x, y, color = "orange", label = "") {
		this.x = x
		this.y = y
		this.color = color
		this.label = label
		// TODO: this.label unused
	}

	render (engine, timestamp) {
		engine.drawCircle(this.x, this.y, 30, this.color)
	}

	onMouseover () {
		
	}

	onMouseout () {

	}
}

export class GraphEdge {
	constructor (startNode, endNode, label = "") {
		this.startNode = startNode
		this.endNode = endNode
		this.label = label
	}

	render (engine, timestamp) {
		const coordinates = [this.startNode, this.endNode].map(node => [node.x, node.y])
		
		if (this.endNode.x < this.startNode.x) {
			engine.drawUpwardCurve(...coordinates)
		} else {
			engine.drawDownwardCurve(...coordinates)
		}
		
		engine.drawText(
			average(this.startNode.x, this.endNode.x),
			average(this.startNode.y, this.endNode.y),
			30,
			this.label
		)
	}
}

// TODO
class ZoomButtons {

}

