function enumerate (arr) {
	
}


/**
 * A non-deterministic finite state automaton is a kind
 * of finite directed graph which represents the computational
 * process of deciding a regular language.
 */

// Although one can think of an NFA as the start state in the NFA, it
// is convenient to have a wrapper which can keep track of overall state
// in one place.
//
// It also makes sure every DFA is valid by asserting that there is always
// at least one start state
class NFA {
    constructor (startState, stateSet, alphabet, isDFA = false) {
        this.startState = startState
        this.stateSet = new Set(stateSet)
        this.alphabet = new Set(alphabet)
        this.reset() // go to the start state
        
        if (!this.startState.isStartState) {
            throw new Error("Start state is not marked as a start state in NFA")
        }
    }
    
    registerTransition (fromState, inputSymbol, toState) {
        fromState.transitions[inputSymbol] ||= new Set() // if not yet defined, create it
		fromState.transitions[inputSymbol].add(toState)
    }
    
    unregisterTransition (fromState, inputSymbol, toState) {
		if (fromState.transitions.hasOwnProperty(inputSymbol)) {
			fromState.transitions[inputSymbol].remove(toState)
			
			// If this causes there to be no more transitions across this symbol
			// from that state, then remove the entry in the state's transition table
			if (fromState.transitions[inputSymbol].size === 0) {
				delete fromState.transitions[inputSymbol]
			}
		}
    }
    
    readSymbol (inputSymbol) {
        if (!this.alphabet.has(inputSymbol)) {
            throw new Error("Symbol", inputSymbol, "not in alphabet")
        }
        
		// Cast to and from set in order to allow for .flatMap, which is only defined for arrays
		// TODO: break up line - it's too long
        this.currentStates = new Set(Array.from(this.currentStates).flatMap(currentState => Array.from(currentState.getNextStates(inputSymbol))))
        this.handleNullTransitions()
    }
    
    handleNullTransitions () {
        const stateQueue = [...this.currentStates]
		console.log("stateQueue is", stateQueue)
        
		let thisState;
        while (thisState = stateQueue.pop()) {
            thisState.getNextStates("").forEach(nextState => {
				console.log("Null transition to", nextState)
                if (!this.currentStates.has(nextState)) {
                    this.currentStates.add(nextState)
                    stateQueue.push(nextState)
                }
            })
        }
    }
    
    // If A --x--> B --(null)--> C, then to remove the null transition
    // we must create a transition A --x--> C, and then eliminate the transition
    // B --(null)--> C
    // We will do this by depth first search, seeded with the start state, and implemented
	// iteratively. 
    eliminateNullTransitions () {
        const exploredStates = new Set()
	const stateQueue = []

    }
    
    // Determines whether or not the NFA is in an accepting state. Usually called once all
	// the input has been consumed -- but doesn't have to be.
    finish () {
        return Array.from(this.currentStates).some(currentState => currentState.isAcceptingState)
    }
    
    reset () {
        this.currentStates = new Set([this.startState])
		
		// TODO: only run this when needed
		this.handleNullTransitions()
    }

    createGraph (height, width) {
		// We use BFS for finding the coordinates of where to place the nodes
		// We already have a list of all the nodes so there's no need to traverse them to find them
		// NOTE: all NFAs that our program deals with are connected, so every node can be found by BFS
		// starting from the start node - but we will check at the end anyway just in case
		
		// First, partitition the graph into layers
		const visitedSet = new Set()
		const allLayers = []

		let currentLayer = [this.startState]

		while (currentLayer.length) {
			allLayers.push(currentLayer)
			let nextLayer = []

			for (let node of currentLayer) {
				visitedSet.add(node)
				nextLayer.push(node)
			}

			currentLayer = nextLayer
		}

		// Next, calculate the best coordinates and instantiate a GraphNode
		// XXX: this will use maths! which is something u can write abou

		const edgeObjects = []
		const nodeObjects = []

		const horizontalNumberOfNodes = allLayers.length
		const xInterval = width / (horizontalNumberOfNodes + 2)

		// Construct the nodes in the grap
		for (let [horizontalIndex, currentLayer] of enumerate(allLayers)) {
			const verticalNumberOfNodes = currentLayer.length
			const yInterval = height / (verticalNumberOfNodes + 2)

			for (let [verticalIndex, node] of currentLayer) {
				const xCoord = xInterval * (1 + horizontalIndex)
				const yCoord = yInterval * (1 + verticalIndex)
				// TODO: textual label
				node.graphNode = new GraphNode(xCoord, yCoord)

				nodeObjects.push(node.graphNode)
			}
		}

		// Construct the edges in the graph
		// Note that although this looks like a nested loop,
		// this is actually an O(n + m) algorithm where n is the number
		// of nodes and m the number of edges. See TODO in documented design.
		allLayers.flat().forEach(node => {
			for (let [transitionSymbol, childNode] of Object.entries(node.transitions)) {
				// TODO: textual label
				edgeObjects.push(new GraphEdge(node.graphNode, childNode.graphNode))
			}
		})

		return [nodeObjects, edgeObjects]
    }
}

class NFAState {
    constructor (humanName, isStartState, isAcceptingState, transitions = {}) {
        this.humanName = humanName
        this.isStartState = isStartState
        this.isAcceptingState = isAcceptingState
        this.transitions = transitions
    }
    
    getNextStates (inputSymbol) {
        if (!this.transitions.hasOwnProperty(inputSymbol)) {
            return new Set();
        } else {
            return this.transitions[inputSymbol]
        }
    }
}
