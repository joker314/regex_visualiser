export class Matrix {
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
		for (let row of this.getRows()) {
			// Calculate an entire row of the resulting matrix:
			const resultingRow = []
			resultingMatrix.push(resultingRow) // it's ok to do this at the start here because resultingRow is stored as a reference
			
			for (let col of otherMatrix.getCols()) {
				const newEntry = row.reduce(
					(accumulatedSum, thisCell, rowNumber) => {
						// Get the associated cell in the other matrix (swapping rows and columns)
						const otherCell = col[rowNumber]
						return accumulatedSum + (thisCell * otherCell)
					},
				0) // initialise the sum with 0 because it's the value of an empty sum
				
				// Add the result to this row of the resulting matrix
				resultingRow.push(newEntry)
			}
		}
		
		return new Matrix(resultingMatrix)
	}
	
	/**
	 * Returns the `rowNumber`th row of the matrix (0-indexed, from the top)
	 */
	getRow (rowNumber) {
		return this.content[rowNumber]
	}
	
	/**
	 * Returns the `colNumber`th column of the matrix (0-indexed, from the left)
	 */
	getCol (colNumber) {
		// Map each row to the cell in that row that is also in the correct column
		return this.content.map(row => row[colNumber])
	}
	
	/**
	 * Returns an iterable of all the rows in this matrix
	 */
	getRows () {
		// In this case, the iterable happens to be an array
		return this.content
	}
	
	/**
	 * Returns an iterable of all the columns in this matrix
	 */
	*getCols () {
		// In this case, the iterable happens to be a Generator object
		// which is returned implicitly as a result of the asterisk in `*getCols` above
		for (let colNumber = 0; colNumber < this.cols; colNumber++) {
			yield this.getCol(colNumber)
		}
	}
	
	/**
	 * Returns the underlying array of this matrix
	 */
	asArray () {
		return this.content
	}
	
	/**
	 * Swaps the rows and columns to produce a new matrix
	 */
	transpose () {
		return new Matrix([...this.getCols()])
	}
}