import {Point} from './vector.js'

export class Transformation {
	constructor (offsetX, offsetY, scale) {
		this.offsetX = offsetX
		this.offsetY = offsetY
		this.scale = scale
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
	
	scalePoint (point) {
		return new Point(...this.scalePosition(point.x, point.y))
	}
}