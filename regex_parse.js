const regexInputBox = document.getElementById("inputted_regex")
const regexOutput = document.getElementById("highlighted_regex")

regexInputBox.addEventListener("input", () => {
	regexOutput.textContent = regexInputBox.value;
	console.log(parse(regexInputBox.value))
})

class ASTNode {
	constructor (startPos, endPos) {
		this.startPos = startPos
		this.endPos = endPos
	}
}

function findParens (str) {
	// TODO: handle escaped parens
	const parenMapping = {}
	const stackOfIndexes = []

	for (let i = 0; i < str.length; i++) {
		if (i === '(') {
			stackOfIndexes.push(i)
		} else if (i === ')') {
			if (stackOfIndexes.length === 0) {
				throw new Error("Unmatched closing parenthesis at " + i)
			}

			const openingParen = stackOfIndexes.pop()
			parenMapping[i] = openingParen
			parenMapping[openingParen] = i
		}
	}

	if (stackOfIndexes.length) {
		throw new Error("Opening parenthesis at " + stackOfIndexes.pop() + " was never closed")
	}

	return parenMapping
}

// TODO: flags for whether juxtaposition/alternation should be variadic or binary
function parse(regexStr, flags = {ALLOW_IMPLICIT_EMPTY: true, VARIADIC_ALTERNATIVES: false}) {
	/**
	 * The precedence for regular expressions shall be:
	 * 1. Parentheses
	 * 2. Quantification
	 * 3. Concatenation (juxtaposition)
	 * 4. Alternation
	 */

	const parenPositions = findParens(regexStr)
	return parseSubstr(0, regexStr.length)

	// XXX: Efficiency savings by passing indexes rather than strings
	function parseSubstr(startPos, endPos) {
		let concatenatedParts = []
		let alternatedParts = []

		const pipePositions = []

		for (let i = startPos; i < endPos; i++) {
			if (substr[i] === '(') {
				// 1. Parse whatever is inside the brackets
				// 2. Wrap it in a ParenNode
				// 3. Jump to after the closing bracket to continue parsing the concatenation region
				const innerParse = parseSubstr(i + 1, parenPositions[i])
				concatenatedPart.push(new ParenNode(i, parenPositions[i] + 1, innerParse))
				i = parenPositions[i]
				continue
			} else if (substr[i] === ')') {
				throw new Error("Closing bracket at position " + i + " has no opening bracket")
			} else if (/[a-zA-Z0-9]/.test(substr[i])) { // XXX: choosing not to use case insensitivity, for maintainability
				concatenatedPart.push(new CharacterNode(i, substr[i]))
			} else if (substr[i] === '+') {
				concatenatedPart.push(new QuantifierNode(i, i + 1, 1, Infinity))
			} else if (substr[i] === '*') {
				concatenatedPart.push(new QuantifierNode(i, i + 1, 0, Infinity))
			} else if (substr[i] === '?') {
				concatenatedPart.push(new QuantifierNode(i, i + 1, 0, 1))
			} else if (substr[i] === '|') {
				alternatedParts.push(new ConcatRegionNode(startPos, i, concatenatedParts))
				concatenatedParts = [] // XXX: can't just use concatenatedParts.length = 0, must create a new object
			} else {
				throw new Error("Unknown character " + substr[i] + " at position " + i)
			}
		}

		if (alternatedParts.length === 0) {
			if (concatenatedParts.length === 1) {
				return concatenatedParts[0]
			} else if (concatenatedParts.length === 0 && !flags.ALLOW_IMPLICIT_EMPTY) {
				throw new Error("Implicit empty subexpression between " + startPos + " and " + endPos)
			} else {
				return new ConcatRegionNode(startPos, endPos, concatenatedParts)
			}
		} else {
			// So far we have only pushed an alternative when we met a pipe, but the subexpression to the right of the final
			// pipe should still be added. We will do that here:
			alternatedParts.push(concatenatedParts[concatenatedParts.length - 1])

			// Then, we should check the flags for how to handle chained alternatives
			if (flags.VARIADIC_ALTERNATIVES) {
				return new VariadicAlternationNode(pipePositions, alternatedParts)
			} else {
				// We will need to chain (left to right) any alternatives
				// Borrowing from the functional programming paradigm, we will fold (reduce)
				// over the alternated parts
				return alternatedParts.reduceRight((acc, currentPart) => new AlternationNode(currentPart, acc))
			}
		}
	}
}

// AST node types:
class ParenNode extends ASTNode {
	constructor (startPos, endPos, groupedData) {
		super(startPos, endPos)
		this.groupedData = groupedData
	}
}

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

class VariadicAlternationNode extends ASTNode {
	// TODO: Variadic alternations is not really well-supported
	constructor (pipePositions, intermediatePortions) {
		this.pipePositions = pipePositions
		this.intermediatePortions = intermediatePortions
	}
}
