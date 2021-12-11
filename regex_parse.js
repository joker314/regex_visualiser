const regexInputBox = document.getElementById("inputted_regex")
const regexOutput = document.getElementById("highlighted_regex")

regexInputBox.addEventListener("input", () => {
	regexOutput.textContent = regexInputBox.value;
})

class ASTNode {
	constructor (startPos, endPos) {
		this.startPos = startPos
		this.endPos = endPos
	}
}

// AST node types:
class ConcatRegionNode extends ASTNode {
	/**
	 * Long strings of just concatenation can be thought of as
	 * just a single region of concatenation. For example, abcd
	 * would be a concatenation region. The purpose of this node is
	 * to glue together a substring of the regex so as to be able to pass
	 * it as the left/right halves of alternation etc.
	 */

	constructor (startPos, endPos, subNodes) {
		super(startPos, endPos)
		this.subNodes = subNodes
	}
}

class QuantifierNode extends ASTNode {
	/**
	 * A quantifier is a symbol like +, *, ?, {a,b}, etc.
	 * which specifies how many times a symbol is allowed to appear.
	 */

	/**
	 * The substring of indices in the interval [startPos, endPos)
	 * which describes a quantification between [minimum,maximum].
	 */
	constructor (startPos, endPos, minimum, maximum) {
		super(startPos, endPos)

		this.rangeMin = minimum
		this.rangeMax = maximum
	}
}

class CharacterNode extends ASTNode {
	/**
	 * Represents a single character, e.g. x, y, z, ...
	 * Does not include escape sequences
	 */
	
	constructor (index, matchedChar) {
		super(index, index + 1)
		
		this.matchedChar = matchedChar
	}
}

class AlternationNode extends ASTNode {
	/**
	 * Represents two branches separated by a pipe
	 */
	
	constructor (pipePos, leftHalf, rightHalf) {
		super (pipePos, pipePos + 1)

		this.leftHalf = leftHalf
		this.rightHalf = rightHalf
	}
}
