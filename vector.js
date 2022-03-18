import {Matrix} from './util/matrix.js'

function unitVectorInDirection (direction) {
	const unitVector = new Vector(
		Math.cos(direction),
		Math.sin(direction)
	)
	
	//console.log("unit vector length is", unitVector.length())
	return unitVector
}

export class Vector {
	constructor (...components) {
		this.components = components
		this.dimension = this.components.length
		
		if (!this.components.every(component => typeof component === "number" && component === component)) {
			console.log(this.components)
			throw new Error("Components to a vector must be numbers")
		}
	}
	
	scale (scalar) {
		return new Vector(...this.components.map(
			component => component * scalar
		))
	}
	
	negate () {
		return this.scale(-1)
	}
	
	add (otherVector) {
		if (otherVector.dimension !== this.dimension) {
			throw new Error("Can only add vectors of the same dimension, but " + this.dimension + " is different to " + otherVector.dimension)
		}
		
		const newComponents = []
		for (let i = 0; i < this.components.length; i++) {
			newComponents.push(this.components[i] + otherVector.components[i])
		}
		
		return new Vector(...newComponents)
	}
	
	minus (otherVector) {
		return this.add(otherVector.negate())
	}
	
	angle () {
		if (this.dimension !== 2) {
			throw new Error("Angle of a vector only implemented for 2D vectors")
		}
		
		const horizontalComponent = this.components[0]
		const verticalComponent = this.components[1]
		
		// XXX: can talk about first trying to do this naively then realising Math.atan2 exists
		return Math.atan2(verticalComponent, horizontalComponent)
	}
	
	length () {
		const sumOfSquares = this.components.reduce((partialSum, currentComponent) => {
			return partialSum + (currentComponent * currentComponent)
		}, 0)
		
		return Math.sqrt(sumOfSquares)
	}
	
	rotate (angle) {
		// Create a transformation matrix associated with a rotation through this angle
		const transformationMatrix = Matrix.rotation(angle)
		
		// Convert this vector into a matrix
		// Relies on this implementation of matrices being immutable
		const vectorMatrix = new Matrix([this.components]).transpose()
		
		// Now perform the multiplication and convert the result back into a vector
		// Matrix is a list of 1 row so need to get the [0]th index
		const transformedVector = transformationMatrix.multiply(vectorMatrix).asArray()[0]
		console.log("the transformed vector is", transformedVector)
		return new Vector(...transformedVector)
	}
	
	fromOrigin () {
		return new Point(...this.components)
	}
}

export class Point {
	constructor (x, y) {
		this.x = x
		this.y = y
	}
	
	// TODO: increase adoption in legacy code
	positionVector () {
		return new Vector(this.x, this.y)
	}
	[Symbol.iterator] () {
		return [this.x, this.y].values()
	}
}