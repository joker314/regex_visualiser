// TODO: move to a util Function
// TODO: scaling code needs reworking now that x and y used internally by simulation?
// TODO: refactor away constants like radius
// or maybe it's fine.
// XXX: curved edges idea from https://bl.ocks.org/mbostock/4600693
// XXX: library API reference at https://github.com/d3/d3-force

import {
	forceSimulation,
	forceLink,
	forceManyBody,
	forceCenter,
	forceCollide
} from "https://cdn.skypack.dev/d3-force@3";

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
		
		const d3GraphEdges = this.graphEdges.map(edge => edge.d3Rep)

		this.simulation = forceSimulation(this.graphNodes)
			.force("link", forceLink(d3GraphEdges).distance(90))
			.force("charge", forceManyBody())
			.force("center", forceCenter())
			.force("collide", forceCollide(30))
			.on("tick", this.render.bind(this))
			
		this.isMouseDown = false
		this.fixedNode = null
		
		this.scale = 1 // XXX: decided to manually handle coordinates so as to consistently handle mouse movements
		this.offsetX = this.canvasElement.width / 2
		this.offsetY = this.canvasElement.height / 2
		this.isRendering = false
		
		this.registerEventListeners()
		//this.startRendering() // XXX: could also involve initialisation logic vs just requestAnimationFrame(this.render)
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
	
	unscalePosition (x, y) {
		return [(x / this.scale) - this.offsetX, (y / this.scale) - this.offsetY]
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
	
	registerEventListeners () {
		const EVENTS = {
			"mousedown": event => {
				this.isMouseDown = true
				this.mouseMoved(event)
			},
			
			"mousemove": event => this.mouseMoved(event),
			
			"mouseup": () => {
				this.isMouseDown = false
				this.fixedNode.fx = this.fixedNode.fy = null
				this.simulation.restart()
			}
		}
		
		for (let [eventName, cb] of Object.entries(EVENTS)) {
			this.canvasElement.addEventListener(eventName, cb.bind(this))
		}
	}
	
	mouseMoved (event) {
		if (!this.isMouseDown) {
			return
		}
		
		console.log("Movement!")
		
		const rectangle = this.canvasElement.getBoundingClientRect()
		
		// TODO: overengineered? ratio is 1:1
		const heightScale = this.canvasElement.height / rectangle.height
		const widthScale = this.canvasElement.width / rectangle.width
		
		const mouseX = (event.clientX - rectangle.left) * widthScale
		const mouseY = (event.clientY - rectangle.top) * heightScale
		
		const [adjustedX, adjustedY] = this.unscalePosition(mouseX, mouseY)
		const nodeToMove = this.simulation.find(adjustedX, adjustedY)
		
		nodeToMove.fx = adjustedX
		nodeToMove.fy = adjustedY
		
		this.fixedNode = nodeToMove
		
		this.simulation.alphaTarget(0.3)
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
		this.d3Rep = {
			source: this.startNode,
			target: this.endNode
		}
	}

	render (engine, timestamp) {
		const coordinates = [this.startNode, this.endNode].map(node => [node.x, node.y])
		
		/**if (this.endNode.x < this.startNode.x) {
			engine.drawUpwardCurve(...coordinates)
		} else {
			engine.drawDownwardCurve(...coordinates)
		}**/
		engine.drawLine(...coordinates)
		
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

