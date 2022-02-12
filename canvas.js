import {Vector} from './vector.js'
export class Canvas {
	constructor (htmlElement) {
		// Short names are a compromise between readability and keeping the line length low enough
		// to still be maintainable
		this.el = htmlElement
		this.ctx = this.el.getContext("2d")		
	}
	
	clearScreen () {
		this.ctx.clearRect(0, 0, this.el.width, this.el.height)	
	}
	
	drawCircle (point, radius, fillCol) {
		this.ctx.beginPath()
		this.ctx.fillStyle = fillCol
		this.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI)
		this.ctx.fill()
	}
	
	drawBezier (start, control, end) {
		this.ctx.beginPath()
		this.ctx.strokeStyle = "red"
		this.ctx.moveTo(start.x, start.y)
		
		// Use the same control point twice
		this.ctx.bezierCurveTo(control.x, control.y, control.x, control.y, end.x, end.y)
		this.ctx.stroke()
	}

	// TODO: scale the font width e.g. binary search?
	drawText (point, fontSize, text) {
		this.ctx.fillStyle = "blue"
		this.ctx.font = fontSize + "px Consolas"
		this.ctx.textAlign = "center"
		this.ctx.fillText(text, point.x, point.y)
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
		
		this.ctx.beginPath()
		this.ctx.fillStyle = "black"
		
		//console.log("this", this, GraphDrawingEngine, this.transformation, this.transformation.scalePosition)
		
		//console.log("arrow shape is", JSON.stringify(rotatedArrow.map(vector => vector.components)))
		const coordinates = rotatedArrow
			.map(vector => vector.add(new Vector(...position)))
			.map(vector => vector.fromOrigin())
			
		this.ctx.beginPath()
		this.ctx.fillStyle = "black"
		this.ctx.moveTo(...coordinates[0])
		
		coordinates.forEach(coordinate => {
			this.ctx.lineTo(...coordinate)
		})
		
		this.ctx.closePath()
		this.ctx.fill()
	}
}