function enumerate (arr) {
	/**
	 * enumerate(["a", "b", "c"]) will, when iterated, produce
	 *
	 * [0, "a"]
	 * [1, "b"]
	 * [2, "c"]
	 *
	 * This is the equivalent to Python's enumerate() function, i.e.
	 * each item is a pair where the first part of the pair is the index,
	 * and the second item is teh actual element.
	 *
	 * Better than .forEach since allows exit-early.
	 *
	 * Uses the iteration protocol.
	 */

	return {
		i: 0,
		
		// Must use long-form anonymous function notation to force correct value of 'this',
		// can't just use () => {}
		next: function () {
			if (this.i >= arr.length) {
				return {done: true}
			}
			
			return {
				// Postincrement so the old value of i is used when calculating [i, arr[i]],
				// but on the next call the value of i will be one bigger.
				value: [this.i, arr[this.i++]]
			}
		},
		
		// Make this both an iterable and an iterator
		[Symbol.iterator]: function () { return this }
	}
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
		
		toState.indegree++
    }
    
    unregisterTransition (fromState, inputSymbol, toState) {
		if (fromState.transitions.hasOwnProperty(inputSymbol)) {
			fromState.transitions[inputSymbol].remove(toState)
			toState.indegree--
			
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
        const seenStates = new Set([this.startState])
		const statesToExplore = [this.startState] // TODO: could be a stack

		while (statesToExplore.length) {
			const currentState = statesToExplore.pop()
			
			// It might be that while we were waiting to explore this state, we have eliminated
			// it
			if (!this.stateSet.has(currentState)) {
				continue
			}
			
			for (let nullChild of currentState.getNextStates("")) {
				unregisterTransition(fromState, "", nullChild)
				
				if (nullChild.indegree === 0 && !nullChild.startState) {
					// The nullChild has no parent. There is no way to reach it from the start state.
					// So it is safe to remove it from the NFA. Note that nullChild might have some
					// outdegree, so we need to unregister each outgoing connection to correctly decrement
					// the indegree of nullChild's children.
					for (let [transitionSymbol, nullChildChildren] of Object.entries(nullChild.transitions)) {
						for (let nullChildChild of nullChildChildren) {
							this.unregisterTransition(nullChild, transitionSymbol, nullChildChild)
						}
					}
					
					this.stateSet.remove(nullChild)
				} else {
					// We can now continue the DFS by pushing all of the children onto the stack
					for (let [transitionSymbol, childStates] of Object.entries(currentState.transitions)) {
						Array.from(childStates)
							.filter(childState => !seenStates.has(childState)) // don't push the same thing onto the stack twice
							.forEach(childState => {
								statesToExplore.push(childState) // schedule this state for the DFS to look at
								seenStates.add(childState) // make sure this state never gets pushed on again
							})
					}
				}
			}
		}
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
		// TODO: consider variable naming - node vs state
		const visitedSet = new Set([this.startState])
		const allLayers = []

		let currentLayer = [this.startState]

		while (currentLayer.length) {
			allLayers.push(currentLayer)
			let nextLayer = []

			for (let node of currentLayer) {
				console.log("Current node in BFS is", node)
				// TODO XXX: cool casting each set to array - consider using elsewhere
				for (let childNode of Object.values(node.transitions).flatMap(set => Array.from(set))) {
					if (visitedSet.has(childNode))
						continue;
				
					nextLayer.push(childNode)
					visitedSet.add(childNode)
				}
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

			for (let [verticalIndex, node] of enumerate(currentLayer)) {
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
			for (let [transitionSymbol, childNodes] of Object.entries(node.transitions)) {
				// TODO: textual label
				for (let childNode of childNodes) {
					console.log("Creating edge", node.graphNode, childNode.graphNode)
					edgeObjects.push(new GraphEdge(node.graphNode, childNode.graphNode, transitionSymbol))
				}
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
		this.indegree = 0
    }
    
    getNextStates (inputSymbol) {
        if (!this.transitions.hasOwnProperty(inputSymbol)) {
            return new Set();
        } else {
            return this.transitions[inputSymbol]
        }
    }
}
