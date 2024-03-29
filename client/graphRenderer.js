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
		// The canvasElement is an HTMLElement, which doesn't support very many
		// features. Create an object which wraps over that HTMLElement so that
		// manipulating the canvas can be done in a more object-oriented way.
		this.canvas = new Canvas(canvasElement)
		
		// Initialise all the components/sprites of the drawing
		this.graphNodes = graphNodes
		this.graphEdges = graphEdges
		this.zoomButtons = new ZoomButtons()
		
		// Set up properties related to dragging
		this.isMouseDown = false
		this.fixedNode = null
		
		// Set up properties related to zooming
		this.transformation = new Transformation(this.canvas.el.width / 2, this.canvas.el.height / 2, 1)
		this.isRendering = false
		
		// Set up event listeners for dragging
		this.listeners = []
		this.registerEventListeners()
		
		// Set up d3 force-based simulation for graph drawing
		const d3GraphEdges = this.graphEdges.flatMap(edge => edge.links)
		const intermediateNodes = this.graphEdges.map(edge => edge.intermediateNode)

		this.simulation = forceSimulation(this.graphNodes.concat(intermediateNodes))
			.force("link", forceLink(d3GraphEdges).distance(edge => {
				// The restorative force on the spring-like edges should be slightly stronger on
				// self-loops, because self-loops are actually composed of several links joined
				// in series
				if (edge.source.isSelf || edge.target.isSelf) {
					return 100
				} else {
					return 90
				}
			}))
			// Each node should be repulsed (like an electrostatic force) from every other node
			.force("charge", forceManyBody())
			// All the nodes should be attracted to the centre of the screen, so they don't fly off
			.force("center", forceCenter())
			// Nodes should not be able to pass through each other
			.force("collide", forceCollide(30).iterations(20))
			// Set up a handler for rendering a frame on each "tick" of the simulation
			.on("tick", this.render.bind(this))
	}

	render (timestamp) {
		this.canvas.clearScreen()

		this.graphNodes.forEach(node => {
			node.render(this, timestamp)
		})

		this.graphEdges.forEach(edge => {
			edge.render(this, timestamp)
		})
	}
	


	startRendering () {
		this.isRendering = true
		window.requestAnimationFrame(this.render.bind(this))
	}
	
	stopRendering () {
		this.isRendering = false
		
		for (let [eventName, listener] of this.listeners) {
			this.canvas.el.removeEventListener(eventName, listener)
		}
		
		this.simulation.stop()
	}
	
	registerEventListeners () {
		const EVENTS = {
			"mousedown": event => {
				this.isMouseDown = true
				if (this.fixedNode) {
					this.fixedNode.fx = this.fixedNode.fy = null
				}
				this.mouseMoved(event)
			},
			
			"mousemove": event => this.mouseMoved(event),
			
			"mouseup": () => {
				this.isMouseDown = false
				if (this.fixedNode) {
					this.fixedNode.fx = this.fixedNode.fy = null
				}
				this.simulation.restart()
			}
		}
		
		for (let [eventName, cb] of Object.entries(EVENTS)) {
			const listener = cb.bind(this)
			
			this.canvas.el.addEventListener(eventName, listener)
			this.listeners.push([eventName, listener])
		}
	}
	
	mouseMoved (event) {
		if (!this.isMouseDown) {
			return
		}
		
		//console.log("Movement!")
		
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
	constructor (x, y, isAccepting, isStarting, isActive, isTrapState, color = "orange", label = "") {
		this.x = x
		this.y = y
		this.isAccepting = isAccepting
		this.isStarting = isStarting
		this.isActive = isActive
		this.isTrapState = isTrapState
		this.label = label
		this.color = color
		// TODO: this.label unused
	}
	
	getPoint () {
		return new Point(this.x, this.y)
	}

	render (engine, timestamp) {
		const position = engine.transformation.scalePoint(this.getPoint())
		
		engine.canvas.drawCircle(position, 30, this.color)
		
		// Add a double border if it's an accepting state
		if (this.isAccepting) {
			engine.canvas.drawCircle(position, 25, this.color)
		}
		
		// Add an inward orange arrow if it's the starting state
		if (this.isStarting) {
			// While it might seem like the following two lines share a lot of content and so it would be good
			// to abstract out the common features, it is actually important information that the arrow head and
			// the spine of the arrow that needs to be explicitly included in the code. In other words, the fact
			// that the two lines are the same is more like a coincidence.
			const topLeft = engine.transformation.scalePoint(this.getPoint().positionVector().add(
				new Vector(0, 60).rotate(3 * Math.PI / 4)
			).fromOrigin())
			
			const bottomRight = engine.transformation.scalePoint(this.getPoint().positionVector().add(
				new Vector(0, 20).rotate(3 * Math.PI / 4)
			).fromOrigin())
			
			engine.canvas.drawLine(topLeft, bottomRight, this.color)
			engine.canvas.arrowAt(bottomRight, engine.transformation.scalePoint(this.getPoint()), this.color)
		}
		
		// Draw a pink circle in the middle if this node is currently active
		if (this.isActive) {
			engine.canvas.drawCircle(position, 10, "pink", true)
		}
	}
}

export class GraphEdge {
	constructor (startNode, endNode, label = "") {
		this.startNode = startNode
		this.endNode = endNode
		this.label = label
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
			
			const diagonalVector = farPoint.minus(nearPoint).scale(2)
			//console.log("Diagonal vector is", diagonalVector.length())
			//console.log("vs", diagonalVector.rotate(0).length())
			
			const cornerA = nearPoint.add(diagonalVector.rotate(Math.PI / 4))
			const cornerB = nearPoint.add(diagonalVector.rotate(-Math.PI / 4))
			
			//engine.canvas.drawCircle(engine.transformation.scalePoint(cornerA.fromOrigin()), 10, "green")
			//engine.canvas.drawCircle(engine.transformation.scalePoint(cornerB.fromOrigin()), 10, "red")
			
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
		engine.canvas.drawBezier(
			this.endNode.isTrapState ? "gray" : "red",
			bezierParameters
		)

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

