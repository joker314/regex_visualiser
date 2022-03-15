import {Vector} from './vector.js'


// This is a triangle shape which is used for the arrow heads. Initially, it points directly
// to the right. It needs to be scaled and rotated later in order to be correct.
// The ARROW_SHAPE is a collection of position vectors.
// XXX: good use of constants
const ARROW_SHAPE = [
	new Vector(0, -5),
	new Vector(0, 5),
	new Vector(10, 0)
]

export class Canvas {
	constructor (htmlElement) {
		// Short names are a compromise between readability and keeping the line length low enough
		// to still be maintainable
		this.el = htmlElement
		this.ctx = this.el.getContext("2d")		
	}
	
	// Instead of trying to change just parts of the drawn image on the canvas, we first clear the
	// entire canvas and then redraw the entire updated content from scratch
	clearScreen () {
		this.ctx.clearRect(0, 0, this.el.width, this.el.height)	
	}
	
	// Draws a straight line of a particular colour between two endpoints. Each point is a
	// Point object.
	drawLine (start, end, color) {
		this.ctx.beginPath()
		this.ctx.strokeStyle = color
		this.ctx.moveTo(start.x, start.y)
		this.ctx.lineTo(end.x, end.y)
		this.ctx.stroke()
	}
	
	// point is a Point object which marks the centre of the circle to be drawn
	drawCircle (point, radius, strokeCol, fill = false) {
		this.ctx.beginPath()
		this.ctx.strokeStyle = this.ctx.fillStyle = strokeCol
		
		// 2 * Math.PI is the number of radians in a full circle
		this.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI)
		
		// If fill is true, then both the outline and the interior of the circle are drawn in the strokCol colour
		// Otherwise, only the outline of the circle is drawn
		if (fill) {
			this.ctx.fill()
		}
		
		this.ctx.stroke()
	}
	
	// Draws a cubic bezier curve of a particulour colour
	// The bezierParameters are the start point, control points, and end points. Each of these
	// is a Point object.
	drawBezier (color, bezierParameters) {
		const [startPoint, ...controlAndEndPoints] = bezierParameters 
		
		this.ctx.beginPath()
		this.ctx.strokeStyle = color
		this.ctx.moveTo(startPoint.x, startPoint.y)

		//console.log("params", bezierParameters)
		this.ctx.bezierCurveTo(...controlAndEndPoints.flatMap(point => [point.x, point.y]))
		this.ctx.stroke()
	}

	// TODO: scale the font width e.g. binary search?
	drawText (point, fontSize, text) {
		this.ctx.fillStyle = "blue"
		this.ctx.font = fontSize + "px Consolas"
		this.ctx.textAlign = "center"
		this.ctx.fillText(text, point.x, point.y)
	}
	
	arrowAt (position, towards, color = "black") {
		const directionVector = new Vector(...towards).minus(new Vector(...position))
		const directionAngle = directionVector.angle()
		
		// To rotate the polygon, it is enough to rotate each position vector corresponding to the polygon's
		// vertices and then join them up
		const rotatedArrow = ARROW_SHAPE.map(
			vector => vector.rotate(directionAngle)
		)
		
		this.ctx.beginPath()
		this.ctx.fillStyle = color

		const coordinates = rotatedArrow
			.map(vector => vector.add(new Vector(...position))) // translate the arrow to the correct position
			.map(vector => vector.fromOrigin()) // convert the position vectors into points
			
		
		// Now join the corners up to build the entire shape
		this.ctx.beginPath()
		this.ctx.fillStyle = color
		this.ctx.moveTo(...coordinates[0])
		
		coordinates.forEach(coordinate => {
			this.ctx.lineTo(...coordinate)
		})
		
		this.ctx.closePath()
		this.ctx.fill()
	}
}