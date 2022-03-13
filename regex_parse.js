const regexInputBox = document.getElementById("inputted_regex")
const regexOutput = document.getElementById("highlighted_regex")
const regexHumanReadable = document.getElementById("human_readable")
const nfaPicture = document.getElementById("nfa-picture")

import {NFA, NFAState} from "./nfa.js"
import {GraphDrawingEngine} from "./graphRenderer.js"

let currentAST = null
let currentNFA = null
let currentEngine = null

regexInputBox.addEventListener("input", () => {
	let astRoot = null

	try {
		astRoot = parse(regexInputBox.value)
	} catch (e) {
		// TODO: better error handling
		regexOutput.textContent = regexInputBox.value + "\n\n" + e.message
	}

	if (astRoot) {
		console.log(astRoot)
		currentAST = astRoot
		regexOutput.replaceChildren(astRoot.generateHTMLHierarchy())
		regexHumanReadable.replaceChildren(astRoot.getHumanReadable())
		
		currentNFA = currentAST.makeNFA()
		
		// Before drawing the graph, it's good to simplify it a lot by eliminating null transitions
		// XXX: splitting it out like this was very helpful as it let me quickly see which section was causing mistakes
		currentNFA.eliminateNullTransitions()
		currentNFA = currentNFA.makeDFA()
		console.log("STATE SIZE IS", currentNFA.stateSet.size)
		currentNFA = currentNFA.minimizeDFA()
		
		if (currentEngine) {
			currentEngine.stopRendering()
		}
		
		currentEngine = new GraphDrawingEngine(nfaPicture, ...currentNFA.createGraph(nfaPicture.height, nfaPicture.width))
	}
})

class ASTNode {
	constructor (startPos, endPos) {
		this.startPos = startPos
		this.endPos = endPos
		this.cachedHumanReadable = null
	}

	generateHTMLHierarchy () {
		throw new Error("generateHTMLHierarchy() not implemented by subclass")
	}

	clone () {
		throw new Error("clone() not implemented by subclass")
	}

	// Cached version of getHumanReadable - calling twice returns the exact same HTMLElement
	getHumanReadable () {
		// TODO: is this too clever?
		return this.cachedHumanReadable ||= this._getHumanReadable()
	}

	_getHumanReadable () {
		throw new Error("_getHumanReadable() not implemented by subclass")
	}

	makeNFA () {
		throw new Error("makeNFA() not implemented by subclass")
	}

	/**
	 * The Computer Science (CS) version of a node should be a separate node
	 * which would work in a Computer Science regular expression. This is a
	 * regular expression whose only quantifier is a Kleene star and where
	 * epsilon is an allowed symbol.
	 */
	makeCSNode () {
		// Unless overriden by a subclass, just clone this node
		return this.clone()
	}
}

function findParens (str) {
	// TODO: handle escaped parens
	const parenMapping = {}
	const stackOfIndexes = []

	for (let i = 0; i < str.length; i++) {
		if (str[i] === '(') {
			stackOfIndexes.push(i)
		} else if (str[i] === ')') {
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
	console.log("The paren positions are", parenPositions)

	return parseSubstr(0, regexStr.length)


	// XXX: Efficiency savings by passing indexes rather than strings
	function parseSubstr(startPos, endPos) {
		console.log("Parsing between", startPos, "and", endPos)
		let concatenatedParts = []
		let alternatedParts = []

		const pipePositions = []

		for (let i = startPos; i < endPos; i++) {
			if (regexStr[i] === '(') {
				// 1. Parse whatever is inside the brackets
				// 2. Wrap it in a ParenNode
				// 3. Jump to after the closing bracket to continue parsing the concatenation region
				const innerParse = parseSubstr(i + 1, parenPositions[i])
				concatenatedParts.push(new ParenNode(i, parenPositions[i] + 1, innerParse))
				i = parenPositions[i]
				continue
			} else if (regexStr[i] === ')') {
				throw new Error("Closing bracket at position " + i + " has no opening bracket")
			} else if (/[a-zA-Z0-9]/.test(regexStr[i])) { // XXX: choosing not to use case insensitivity, for maintainability
				concatenatedParts.push(new CharacterNode(i, regexStr[i]))
			} else if ('+*?'.includes(regexStr[i])) {
				let lowerBound = null
				let upperBound = null

				switch (regexStr[i]) {
					case "+":
						lowerBound = 1
						upperBound = Infinity
						break
					case "*":
						lowerBound = 0
						upperBound = Infinity
						break
					case "?":
						lowerBound = 0
						upperBound = 1
						break
				}

				if (concatenatedParts.length === 0) {
					throw new Error("Quantifier at position " + i + " is not quantifying over anything")
				}

				// Pop off the last unit of concatenation, and then push back on the quantified version
				concatenatedParts.push(new QuantifierNode(i, i + 1, lowerBound, upperBound, regexStr[i], concatenatedParts.pop()))
			} else if (regexStr[i] === '|') {
				alternatedParts.push(new ConcatRegionNode(startPos, i, concatenatedParts))
				concatenatedParts = [] // XXX: can't just use concatenatedParts.length = 0, must create a new object
			} else {
				throw new Error("Unknown character " + regexStr[i] + " at position " + i)
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
			alternatedParts.push(new ConcatRegionNode(pipePositions[pipePositions.length - 1] + 1, endPos, concatenatedParts))

			// Then, we should check the flags for how to handle chained alternatives
			if (flags.VARIADIC_ALTERNATIVES) {
				return new VariadicAlternationNode(pipePositions, alternatedParts)
			} else {
				// We will need to chain (left to right) any alternatives
				// Borrowing from the functional programming paradigm, we will fold (reduce)
				// over the alternated parts
				return alternatedParts.reduceRight((acc, currentPart, i) => new AlternationNode(pipePositions[i], currentPart, acc))
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

	clone () {
		return new ParenNode(this.startPos, this.endPos, this.groupedData)
	}

	generateHTMLHierarchy () {
		const bracketContainer = document.createElement("SPAN")
		const openingParen = document.createElement("SPAN")
		const closingParen = document.createElement("SPAN")
		
		function mouseoverCb () {
			openingParen.classList.add("matching-parens")
			closingParen.classList.add("matching-parens")
			this.getHumanReadable().classList.add("readable-selected")
		}

		function mouseoutCb () {
			openingParen.classList.remove("matching-parens")
			closingParen.classList.remove("matching-parens")
			this.getHumanReadable().classList.remove("readable-selected")
		}

		openingParen.addEventListener("mouseover", mouseoverCb)
		closingParen.addEventListener("mouseover", mouseoverCb)
		
		openingParen.addEventListener("mouseout", mouseoutCb)
		closingParen.addEventListener("mouseout", mouseoutCb)

		openingParen.textContent = "("
		closingParen.textContent = ")"

		bracketContainer.appendChild(openingParen)
		bracketContainer.appendChild(this.groupedData.generateHTMLHierarchy())
		bracketContainer.appendChild(closingParen)

		return bracketContainer
	}

	getPlaintext () {
		return "(" + this.groupedData.getPlaintext() + ")"
	}

	_getHumanReadable () {
		// It would just create clutter to explain that the parentheses do nothing
		// Their presence changes how data is grouped together - which is presented implicitly, in other ways
		return this.groupedData.getHumanReadable()
	}

	makeNFA () {	
		return this.groupedData.makeNFA()
	}
}

class ConcatRegionNode extends ASTNode {
	/**
	 * Long strings of just concatenation can be thought of as
	 * just a single region of concatenation. For example, abcd
	 * would be a concatenation region. The purpose of this node is
	 * to glue together a subing of the regex so as to be able to pass
	 * it as the left/right halves of alternation etc.
	 */

	constructor (startPos, endPos, subNodes) {
		super(startPos, endPos)
		this.subNodes = subNodes
	}

	clone () {
		return new ConcatRegionNode(this.startPos, this.endPos, this.subNodes)
	}

	generateHTMLHierarchy () {
		const concatContainer = document.createElement("SPAN")
		this.subNodes.forEach(subNode => concatContainer.appendChild(subNode.generateHTMLHierarchy()))

		return concatContainer
	}

	getPlaintext () {
		return this.subNodes.map(subNode => subNode.getPlaintext()).join('')
	}

	_getHumanReadable () {
		const readableContainer = document.createElement("DIV")
		const explanatoryNote = document.createElement("P")

		readableContainer.appendChild(explanatoryNote)
		explanatoryNote.textContent = "Each of the following must be matched in sequence"

		const listOfDetails = document.createElement("UL")
		readableContainer.appendChild(listOfDetails)

		this.subNodes.forEach(subNode => {
			const listItem = document.createElement("LI")
			const detailsContainer = document.createElement("DETAILS")
			const summaryContainer = document.createElement("SUMMARY")
			const summaryName = document.createElement("CODE")
			
			listOfDetails.appendChild(listItem)
			listItem.appendChild(detailsContainer)
			detailsContainer.appendChild(summaryContainer)
			summaryContainer.appendChild(summaryName)

			summaryName.textContent = subNode.getPlaintext()
			detailsContainer.open = true

			detailsContainer.appendChild(subNode.getHumanReadable())
		})

		readableContainer.classList.add('readable-container')

		return readableContainer
	}
	
	/* We just construct a sequence of (two or more) NFAs, and join them together
	 *
	 * X --- Y      A --- B
	 *   --- Z        --- C
	 *   --- W        --- D
	 *
	 * The above two NFAs can be joined together by adding a null transition from
	 * Y to A, from Z to A, and from W to A. This null transition can be eliminated once
	 * the NFA has been constructed, see NFA.prototype.eliminateNullTransitions
	 */
	makeNFA () {
		// Note that the below algorithm mutates all of the NFAs for efficiency.
		// But all we would need to do to resolve this is to clone them.
		
		// XXX: use of map-reduce technique!
		return this.subNodes
			.map(astNode => astNode.makeNFA())
			.reduce((accumulatedNFA, currentNFA) => {
				// We now need to combine the two NFAs.
				// This involves taking all the accepting states of the
				// accumulated NFA and creating a transition between them
				// and the start state of currentNFA.
				Array.from(accumulatedNFA.stateSet)
					.filter(state => state.isAcceptingState)
					.forEach(acceptingState => {
						accumulatedNFA.registerTransition(acceptingState, "", currentNFA.startState)
						
						// The accepting states of accumulatedNFA should be downgraded
						// to just ordinary states (since currentNFA's accepting states
						// will be used instead).
						acceptingState.isAcceptingState = false
					})
				
				// Similarly, the start state of currentNFA
				// should be downgraded to a normal state (because accumulatedNFA's start
				// state will be used instead)
				currentNFA.startState.isStartState = false
				
				// All the states from currentNFA need to be registered with accumulatedNFA - since
				// accumulatedNFA is taking ownership of them. Similarly for the alphabet.
				currentNFA.stateSet.forEach(state => accumulatedNFA.stateSet.add(state))
				currentNFA.alphabet.forEach(character => accumulatedNFA.alphabet.add(character))
				
				accumulatedNFA.reset()
				
				// We've now appended currentNFA to accumulatedNFA, which means currentNFA is invalid (it doesn't have a start state)
				// and accumulatedNFA has been mutated to contain the states from both NFAs. So that's the one we should return.
				return accumulatedNFA
			})
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
	constructor (startPos, endPos, minimum, maximum, textRepresentation, repeatedBlock) {
		super(startPos, endPos)

		this.rangeMin = minimum
		this.rangeMax = maximum
		this.textRepresentation = textRepresentation
		this.repeatedBlock = repeatedBlock
	}

	clone () {
		return new QuantifierNode(this.startPos, this.endPos, this.rangeMin, this.rangeMax, this.textRepresentation, this.repeatedBlock)
	}

	generateHTMLHierarchy () {
		const quantifierContainer = document.createElement("SPAN")
		const textRepSpan = document.createElement("SPAN")
		const repeatedBlockSpan = document.createElement("SPAN")

		textRepSpan.textContent = this.textRepresentation
		repeatedBlockSpan.appendChild(this.repeatedBlock.generateHTMLHierarchy())

		textRepSpan.addEventListener("mouseover", () => {
			textRepSpan.classList.add("highlighted")
			repeatedBlockSpan.classList.add("underlined")
			this.getHumanReadable().classList.add("readable-selected")
		})

		textRepSpan.addEventListener("mouseout", () => {
			textRepSpan.classList.remove("highlighted")
			repeatedBlockSpan.classList.remove("underlined")
			this.getHumanReadable().classList.remove("readable-selected")
		})

		quantifierContainer.appendChild(repeatedBlockSpan)
		quantifierContainer.appendChild(textRepSpan)

		return quantifierContainer
	}

	getPlaintext () {
		return this.repeatedBlock.getPlaintext() + this.textRepresentation
	}

	_getHumanReadable () {
		const readableContainer = document.createElement("DIV")
		const explanatoryNote = document.createElement("P")

		explanatoryNote.textContent = "The " + this.textRepresentation + " at the end matches the following subexpression between " + this.rangeMin + " and " + this.rangeMax + " (inclusive) times"
		readableContainer.appendChild(explanatoryNote)

		const detailsContainer = document.createElement("DETAILS")
		const summaryContainer = document.createElement("SUMMARY")
		const summaryName = document.createElement("CODE")
		
		readableContainer.appendChild(detailsContainer)
		detailsContainer.appendChild(summaryContainer)
		summaryContainer.appendChild(summaryName)

		summaryName.textContent = this.repeatedBlock.getPlaintext()
		detailsContainer.open = true

		detailsContainer.appendChild(this.repeatedBlock.getHumanReadable())

		readableContainer.classList.add("readable-container")
		return readableContainer
	}

	// We can keep the Kleene star quantification, but we must rewrite the + quantification
	makeCSNode () {
		// TODO: startpos, endpos not being used and should be removed after survey
	
		// Helper function to repeat a block a certain number of times
		// TODO: make static method
		function repeatTimes(block, n) {
			return Array(n) // create an array of n empty slots
				.fill(null) // replace the empty slots with dummy values so they can be .map()ed over
				.map(() => block.clone()) // create a NEW clone of the block each time - so
										  // changes to one won't affect the other
		}

		// We will break down something like U{3,infinity} into
		// 1. inlinedRepetition --> UUU
		// 2. kleeneStar ---> U*
		// so the resulting expanded form is (UUU)U*

		// First let's create the finite prefix of Us. For example, if we need between 4 and 50 U's,
		// then this line creates the first 4 Us.
		const inlinedRepetitions = repeatTimes(this.repeatedBlock, this.rangeMin)
		
		// Next let's finish off the expanded regular expression with the suffix. There are two cases: if the upper bound is finite, we need
		// to create a collection of alternatives (<empty>|U|UU|UUU|UUUU|UUUUU|...). But if the upper bound is infinity, we
		// can use the Kleene star U* to accomplish the same thing
		let suffix = null

		if (this.rangeMax === Infinity) {
			suffix = new QuantifierNode(this.startPos, this.endPos, 0, Infinity, "*", this.repeatedBlock.clone())
		} else {
			const alternatives = []

			for (let repititionCount = this.rangeMin; repititionCount <= this.rangeMax; repititionCount++) {
				if (repititionCount === 0) {
					// TODO: use epsilon instead
					alternatives.push(new CharacterNode(this.startPos, ''))	
				} else {
					// TODO: move concatenation out into that helper function?
					alternatives.push(new ConcatRegionNode(-1, -1, repeatTimes(this.repeatedBlock, repititionCount)))
				}
			}

			// TODO: no position info
			// TODO: abstract this pattern out
			suffix = alternatives.reduceRight((acc, currentPart, i) => new AlternationNode(-1, currentPart, acc))
		}
		
		return new ConcatRegionNode(this.startNode, this.endNode, [...inlinedRepetitions, suffix])
	}
	
	makeNFA () {
		if (this.rangeMin !== 0 || this.rangeMax !== Infinity) {
			return this.makeCSNode().makeNFA()
		}
		
		// Construct the NFA of the repeated block, and then create cycles by attaching a null transition from the accepting
		// states back to the starting state.
		//
		// Initially, resultingNFA is just the repeatedBlock's NFA. But it will be modified in-place so as to contain the necessary
		// cycles.
		const resultingNFA = this.repeatedBlock.makeNFA()
		
		Array.from(resultingNFA.stateSet)
			.filter(state => state.isAcceptingState)
			.forEach(acceptingState => {
				resultingNFA.registerTransition(acceptingState, "", resultingNFA.startState)
			})
		
		// Make the starting state an accepting state, to allow matching the empty strings
		resultingNFA.startState.isAcceptingState = true
		
		resultingNFA.reset()
		return resultingNFA
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

	clone () {
		return new CharacterNode(this.startPos, this.matchedChar)
	}

	generateHTMLHierarchy () {
		const textContainer = document.createElement("SPAN")
		textContainer.textContent = this.matchedChar

		// TODO: refactor all of these to use a single helper function for highlight/dehighlight
		textContainer.addEventListener("mouseover", () => {
			textContainer.classList.add("highlighted")
			this.getHumanReadable().classList.add("readable-selected")
		})

		textContainer.addEventListener("mouseout", () => {
			textContainer.classList.remove("highlighted")
			this.getHumanReadable().classList.remove("readable-selected")
		})
		
		return textContainer
	}

	getPlaintext () {
		return this.matchedChar
	}

	_getHumanReadable () {
		const explanatoryNote = document.createElement("DIV")
		const kbdEl = document.createElement("KBD") // TODO: decide whether this matches the semantic meaning of <KBD>
		kbdEl.textContent = this.matchedChar

		explanatoryNote.appendChild(document.createTextNode("Matches the character "))
		explanatoryNote.appendChild(kbdEl)
		explanatoryNote.appendChild(document.createTextNode(" literally"))

		explanatoryNote.classList.add("readable-container")

		return explanatoryNote
	}
	
	makeNFA () {
		// The associated NFA of a single character is two nodes -- the start state,
		// and the accepting state. There is just one transition, which is the character.
		const startState = new NFAState(this.matchedChar + "(left)", true, false)
		const acceptingState = new NFAState("(right)" + this.matchedChar, false, true)
		// TODO: decide on alphabet
		const resultingNFA = new NFA(startState, [startState, acceptingState], [this.matchedChar])
		resultingNFA.registerTransition(startState, this.matchedChar, acceptingState)
		
		resultingNFA.reset()
		return resultingNFA
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

	clone () {
		return new AlternationNode(this.startPos, this.leftHalf, this.rightHalf)
	}

	generateHTMLHierarchy () {
		const alternationContainer = document.createElement("SPAN")
		const leftContainer = document.createElement("SPAN")
		const rightContainer = document.createElement("SPAN")
		const pipeContainer = document.createElement("SPAN")

		leftContainer.appendChild(this.leftHalf.generateHTMLHierarchy())
		pipeContainer.textContent = "|"
		rightContainer.appendChild(this.rightHalf.generateHTMLHierarchy())

		pipeContainer.addEventListener("mouseover", () => {
			leftContainer.classList.add("underlined")
			rightContainer.classList.add("underlined")
			pipeContainer.classList.add("highlighted")
			this.getHumanReadable().classList.add("readable-selected")
		})

		pipeContainer.addEventListener("mouseout", () => {
			leftContainer.classList.remove("underlined")
			rightContainer.classList.remove("underlined")
			pipeContainer.classList.remove("highlighted")
			this.getHumanReadable().classList.remove("readable-selected")
		})

		alternationContainer.appendChild(leftContainer)
		alternationContainer.appendChild(pipeContainer)
		alternationContainer.appendChild(rightContainer)

		return alternationContainer
	}

	getPlaintext () {
		return this.leftHalf.getPlaintext() + "|" + this.rightHalf.getPlaintext()
	}

	_getHumanReadable () {
		const readableContainer = document.createElement("DIV")
		const explanatoryText = document.createElement("P")

		readableContainer.appendChild(explanatoryText)
		explanatoryText.textContent = "To match this regular expression, you must " +
					      "match either one of the following two regular " +
					      "expressions:"

		// TODO: just implement as extension of VariadicAlternationNode
		const firstDetails = document.createElement("DETAILS")
		const firstSummary = document.createElement("SUMMARY")
		const firstSummaryName = document.createElement("CODE")

		const secondDetails = document.createElement("DETAILS")
		const secondSummary = document.createElement("SUMMARY")
		const secondSummaryName = document.createElement("CODE")

		firstDetails.appendChild(firstSummary)
		firstSummary.appendChild(document.createTextNode("Option 1: "))
		firstSummary.appendChild(firstSummaryName)
		firstSummaryName.textContent = this.leftHalf.getPlaintext()
		firstDetails.appendChild(this.leftHalf.getHumanReadable())

		secondDetails.appendChild(secondSummary)
		secondSummary.appendChild(document.createTextNode("Option 2: "))
		secondSummary.appendChild(secondSummaryName)
		secondSummaryName.textContent = this.rightHalf.getPlaintext()
		secondDetails.appendChild(this.rightHalf.getHumanReadable())

		readableContainer.appendChild(firstDetails)
		readableContainer.appendChild(secondDetails)

		readableContainer.classList.add("readable-container")

		return readableContainer
	}
	
	makeNFA () {
		/**
		 * In order to give the option of starting at either leftHalf's starting state
		 * or leftHalf's starting state, we create a new starting node which has two null
		 * transitions, one to each of the two other starting states. (This means those stop
		 * being start states in favour of this new one).
		 */
		 // XXX: make sure eliminating null transitions works even for starting states as this is an edge case
		 
		 const newStartingState = new NFAState("alt prong", true, false)
		 const leftNFA = this.leftHalf.makeNFA()
		 const rightNFA = this.rightHalf.makeNFA()
		 
		 // This essentially computes the set union of the two sets
		 const newAlphabet = [...leftNFA.alphabet, ...rightNFA.alphabet]
		 const newStateSet = [...leftNFA.stateSet, ...rightNFA.stateSet, newStartingState]
		 
		 const resultingNFA = new NFA(newStartingState, newStateSet, newAlphabet)
		 resultingNFA.registerTransition(newStartingState, "", leftNFA.startState)
		 resultingNFA.registerTransition(newStartingState, "", rightNFA.startState)
		 
		 // Remove the two starting states since newStartingState is now the starting state of the combined NFA
		 leftNFA.startState.isStartState = false
		 rightNFA.startState.isStartState = false
		 
		 resultingNFA.reset()
		 return resultingNFA
	}
}

class VariadicAlternationNode extends ASTNode {
	// TODO: Variadic alternations is not really well-supported
	constructor (pipePositions, intermediatePortions) {
		this.pipePositions = pipePositions
		this.intermediatePortions = intermediatePortions
	}

	clone () {
		return new VariadicAlternationNode(this.pipePositions, this.intermediatePortions)
	}

	generateHTMLHierarchy () {
		const alternationContainer = document.createElement("SPAN")
		const intermediatePortionContainers = this.intermediatePortions.map(portion => {
			const element = document.createElement("SPAN")
			element.appendChild(portion.generateHTMLHierarchy())
			return element
		})

		const pipeContainers = []

		for (let i = 0; i < intermediatePortionContainers; i++) {
			if (i > 0) {
				// Place a pipe before each container (except for the very first one)
				const pipe = document.createElement("SPAN")
				pipe.textContent = "|"

				pipe.addEventListener("mouseover", () => {
					intermediatePortionContainers.forEach(container => container.classList.add("underlined"))
					pipeContainers.forEach(pipe => pipe.classList.add("matching-parens"))
					this.getHumanReadable().classList.add("readable-selected")
				})

				pipe.addEventListener("mouseout", () => {
					intermediatePortionContainers.forEach(container => container.classList.remove("underlined"))
					pipeContainers.forEach(pipe => pipe.classList.remove("matching-parens"))
					this.getHumanReadable().classList.remove("readable-selected")
				})

				pipeContainers.push(pipe)
				alternationContainer.push(pipe)
			}

			alternationContainer.appendChild(intermediatePortionContainers[i])
		}
	}

	getPlaintext () {
		// TODO
		return "((not implemented))"
	}

	_getHumanReadable () {
		// TODO
		return document.createTextNode("((not implemented))")
	}
}
