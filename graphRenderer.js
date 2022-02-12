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
			.force("charge", forceManyBody())
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
		
		this.intermediateNode = {
			x: average(this.startNode.x, this.endNode.x),
			y: average(this.startNode.y, this.endNode.y)
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
		const bezierParameters = [
			this.startNode.getPoint(),
			new Point(this.intermediateNode.x, this.intermediateNode.y),
			this.endNode.getPoint()
		].map(point => engine.transformation.scalePoint(point))
		
		engine.canvas.drawBezier(...bezierParameters)
		
		const endPoint = bezierParameters[2]
		
		engine.canvas.arrowAt(bezier(bezierParameters, 0.2), endPoint)
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

