import {enumerate} from '../util/iteration.js'

class Matrix {
	constructor (content) {
		this.content = content
		
		if (this.content.length === 0) {
			throw new Error("Empty matrices are not supported")
		}
		
		this.rows = this.content.length
		this.cols = this.content[0].length // index 0 now guaranteed to exist, so this is safe
	}
	
	static rotation (angle) {
		// https://en.wikipedia.org/wiki/Rotation_matrix
		return new Matrix([
			[Math.cos(angle), -Math.sin(angle)],
			[Math.sin(angle), Math.cos(angle)]
		])
	}
	
	multiply (otherMatrix) {
		// Check to make sure the dimensions of the matrices are compatible
		if (this.cols !== otherMatrix.rows) {
			throw new Error("Cannot multiply two matrices because the dimensions are incompatible")
		}
		
		// Store the resulting matrix here, which will be returned at the end
		const resultingMatrix = []
		
		// For each row in the original matrix
		for (let [rowNumber, row] of enumerate(this.content)) {
			// Calculate an entire row of the resulting matrix:
			const resultingRow = []
			resultingMatrix.push(resultingRow) // it's ok to do this here because resultingRow is stored as a reference
			
			for (let colNumber = 0; colNumber < otherMatrix.cols; colNumber++) {
				const newEntry = row.reduce(
					(accumulatedSum, thisCell, i) => {
						// Get the associated cell in the other matrix (swapping rows and columns)
						const otherCell = otherMatrix.content[i][colNumber]
						
						console.log("Multiplying", thisCell, otherCell)
						return accumulatedSum + (thisCell * otherCell)
					},
				0) // initialise the sum with 0 because it's the value of an empty sum
				
				// Add the result to this row of the resulting matrix
				resultingRow.push(newEntry)
			}
		}
		
		return new Matrix(resultingMatrix)
	}
}