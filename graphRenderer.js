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

import {Vector, Point} from './vector.js'
import {Transformation} from './transformation.js'

import {random, average, bezier} from './util.js'

import {Canvas} from './canvas.js'

/**
 * Can be used to render arbitrary graphs using a force-directed technique
 */

export class GraphDrawingEngine {
	// TODO: decide whether to use a queue or callback for I/O
	constructor (canvasElement, graphNodes, graphEdges) {
		this.canvas = new Canvas(canvasElement)
		
		this.graphNodes = graphNodes
		this.graphEdges = graphEdges
		this.zoomButtons = new ZoomButtons()
		
		
		this.isMouseDown = false
		this.fixedNode = null
		
		this.transformation = new Transformation(this.canvas.el.width / 2, this.canvas.el.height / 2, 1)
		this.isRendering = false
		
		this.registerEventListeners()
		
		const d3GraphEdges = this.graphEdges.flatMap(edge => edge.links)
		const intermediateNodes = this.graphEdges.map(edge => edge.intermediateNode)

		this.simulation = forceSimulation(this.graphNodes.concat(intermediateNodes))
			.force("link", forceLink(d3GraphEdges).distance(90))
			.force("charge", forceManyBody().strength(node => {
				// In self-loops, the intermediate node is being pulled on with double the strength
				// so let's increase the repulsive force to account for that
				if (node.isSelf) {
					return -90
				}
				
				return -30
			}))
			.force("center", forceCenter())
			.force("collide", forceCollide(30).iterations(20))
			.on("tick", this.render.bind(this))
	}

	render (timestamp) {
		this.canvas.clearScreen()

		this.graphNodes.forEach(node => {
			node.render(this, timestamp)
		})

		this.graphEdges.forEach(edge => {
			edge.render(this, timestamp)
			// DEBUG TODO
			this.canvas.drawCircle(this.transformation.scalePoint(edge.intermediateNode), 10, "black")
		})
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
			this.canvas.el.addEventListener(eventName, cb.bind(this))
		}
	}
	
	mouseMoved (event) {
		if (!this.isMouseDown) {
			return
		}
		
		console.log("Movement!")
		
		const rectangle = this.canvas.el.getBoundingClientRect()
		
		// TODO: overengineered? ratio is 1:1
		const heightScale = this.canvas.el.height / rectangle.height
		const widthScale = this.canvas.el.width / rectangle.width
		
		const mouseX = (event.clientX - rectangle.left) * widthScale
		const mouseY = (event.clientY - rectangle.top) * heightScale
		
		const [adjustedX, adjustedY] = this.transformation.unscalePosition(mouseX, mouseY)
		const nodeToMove = this.simulation.find(adjustedX, adjustedY)
		
		nodeToMove.fx = adjustedX
		nodeToMove.fy = adjustedY
		
		this.fixedNode = nodeToMove
		
		this.simulation.alphaTarget(0.3).restart()
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
	
	getPoint () {
		return new Point(this.x, this.y)
	}

	render (engine, timestamp) {
		//console.log(engine)
		const position = engine.transformation.scalePoint(this.getPoint())
		
		engine.canvas.drawCircle(position, 30, this.color)
	}
}

export class GraphEdge {
	constructor (startNode, endNode, label = "") {
		this.startNode = startNode
		this.endNode = endNode
		this.label = label
		
		if (this.startNode === this.endNode) {
			// This is a self-loop.
			// Place it at a random location 40 units away from the centre.
			this.intermediateNode = this.startNode.getPoint().positionVector().add(
				new Vector(80, 0).rotate(random(0, 2 * Math.PI))
			).fromOrigin()
			
			this.intermediateNode.isSelf = true
		} else {
			this.intermediateNode = new Point(
				average(this.startNode.x, this.endNode.x),
				average(this.startNode.y, this.endNode.y)
			)
		}
		
		this.links = [
			{
				source: this.startNode,
				target: this.intermediateNode
			},
			{
				source: this.intermediateNode,
				target: this.endNode
			}
		]
	}

	render (engine, timestamp) {
		let bezierParameters;
		const intermediatePoint = new Point(this.intermediateNode.x, this.intermediateNode.y)
		
		if (this.startNode === this.endNode) { // self loop
			// If the startNode and intermediateNode are opposite corners of a square, we need
			// to find the other two corners to make them the control points.
			const nearPoint = this.startNode.getPoint().positionVector()
			const farPoint = intermediatePoint.positionVector()
			
			const diagonalVector = farPoint.minus(nearPoint)
			console.log("Diagonal vector is", diagonalVector.length())
			console.log("vs", diagonalVector.rotate(0).length())
			
			const cornerA = nearPoint.add(diagonalVector.rotate(Math.PI / 4))
			const cornerB = nearPoint.add(diagonalVector.rotate(-Math.PI / 4))
			
			engine.canvas.drawCircle(engine.transformation.scalePoint(cornerA.fromOrigin()), 10, "green")
			engine.canvas.drawCircle(engine.transformation.scalePoint(cornerB.fromOrigin()), 10, "red")
			
			bezierParameters = [
				this.startNode.getPoint(),
				cornerA.fromOrigin(),
				cornerB.fromOrigin(),
				this.endNode.getPoint()
			]
		} else {
			// We can make a quadratic Bezier curve with 3 points, but all Bezier curve functions
			// only work with cubic curves. We need to repeat one of the control points to simulate this
			bezierParameters = [
				this.startNode.getPoint(),
				intermediatePoint,
				intermediatePoint,
				this.endNode.getPoint()
			]
		}
		
		bezierParameters = bezierParameters.map(point => engine.transformation.scalePoint(point))		
		engine.canvas.drawBezier(bezierParameters)

		engine.canvas.arrowAt(bezier(bezierParameters, 0.2), engine.transformation.scalePoint(this.endNode.getPoint()))
		engine.canvas.drawText(
			bezier(bezierParameters, 0.5),
			30,
			this.label
		)
	}
}

// TODO
class ZoomButtons {

}

