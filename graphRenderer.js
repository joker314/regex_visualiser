// TODO: move to a util Function
// TODO: scaling code needs reworking now that x and y used internally by simulation?
// TODO: refactor away constants like radius
// TODO: move into submodules
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

import {Vector} from './vector.js'
import {Transformation} from './transformation.js'

import {random} from './util.js'

function average(a, b, weight = 0.5) {
	const antiweight = 1 - weight
	
	return (weight * a) + (antiweight * b)
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
		
		
		/**
		this.scale = 1 // XXX: decided to manually handle coordinates so as to consistently handle mouse movements
		this.offsetX = this.canvasElement.width / 2
		this.offsetY = this.canvasElement.height / 2
		*/
		this.transformation = new Transformation(this.canvasElement.width / 2, this.canvasElement.height / 2, 1)
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

	drawCircle (x, y, r, fillCol) {
		const [newX, newY] = this.transformation.scalePosition(x, y)
		const newR = this.transformation.scaleDistance(r)
		
		this.context2d.beginPath()
		this.context2d.fillStyle = fillCol
		this.context2d.arc(newX, newY, newR, 0, 2 * Math.PI)
		this.context2d.fill()
	}
	
	drawOffsetCurve (startPos, endPos, verticalOffset, horizontalOffset) {
		const [startX, startY] = this.transformation.scalePosition(...startPos)
		const [endX, endY] = this.transformation.scalePosition(...endPos)
		
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
		this.context2d.fillText(text, ...this.transformation.scalePosition(x, y))
	}

	startRendering () {
		this.isRendering = true
		window.requestAnimationFrame(this.render.bind(this))
	}
	
	registerEventListeners () {
		const EVENTS = {
			"mousedown": event => {
				this.isMouseDown = true
				this.fixedNode.fx = this.fixedNode.fy = null
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
		
		const [adjustedX, adjustedY] = this.transformation.unscalePosition(mouseX, mouseY)
		const nodeToMove = this.simulation.find(adjustedX, adjustedY)
		
		nodeToMove.fx = adjustedX
		nodeToMove.fy = adjustedY
		
		this.fixedNode = nodeToMove
		
		this.simulation.alphaTarget(0.3)
	}
	
	arrowAt (position, towards) {
		const ARROW_SHAPE = [
			new Vector(0, -20),
			new Vector(0, 20),
			new Vector(40, 0)
		]
		
		//console.log("Position", position)
		//console.log("Towards", towards)
		
		const directionVector = new Vector(...towards).minus(new Vector(...position))
		const directionAngle = directionVector.angle()
		
		const rotatedArrow = ARROW_SHAPE.map(
			vector => vector.rotate(directionAngle)
		)
		
		this.context2d.beginPath()
		this.context2d.fillStyle = "black"
		
		//console.log("this", this, GraphDrawingEngine, this.transformation, this.transformation.scalePosition)
		
		//console.log("arrow shape is", JSON.stringify(rotatedArrow.map(vector => vector.components)))
		const coordinates = rotatedArrow
			.map(vector => vector.add(new Vector(...position)))
			.map(vector => this.transformation.scalePosition(...vector.components))
			
		this.context2d.beginPath()
		this.context2d.fillStyle = "black"
		this.context2d.moveTo(...coordinates[0])
		
		coordinates.forEach(coordinate => {
			this.context2d.lineTo(...coordinate)
		})
		
		this.context2d.closePath()
		
		this.context2d.fill()
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
		
		this.intermediateNode = {
			x: average(this.startNode.x, startNode.y),
			y: average(this.startNode.x, startNode.y)
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
		
		engine.arrowAt([average(this.startNode.x, this.endNode.x, 0.3), average(this.startNode.y, this.endNode.y, 0.3)], coordinates[1])
		
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

