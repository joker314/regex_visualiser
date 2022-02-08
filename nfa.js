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
		
		if (!fromState.transitions[inputSymbol].has(toState)) {
			toState.indegree++
			fromState.transitions[inputSymbol].add(toState)
		}
    }
    
    unregisterTransition (fromState, inputSymbol, toState) {
		if (fromState.transitions.hasOwnProperty(inputSymbol)) {
			if (fromState.transitions[inputSymbol].has(toState)) {
				toState.indegree--
				fromState.transitions[inputSymbol].delete(toState)
			}
			
			// If this causes there to be no more transitions across this symbol
			// from that state, then remove the entry in the state's transition table
			if (fromState.transitions[inputSymbol].size === 0) {
				delete fromState.transitions[inputSymbol]
			}
		}
		
		// The only way to get to a state is to start at the startState and then move along
		// the transitions. This means that every reachable state must either be the startState
		// or must have an incoming transition. Since this state is now neither, we can safely delete
		// both the state and its outgoing transitions.
		//
		// Note that this can lead to recursive calls because by removing these outgoing transitions, we may
		// decrement some other state's indegree down to 0. Intuitively, this means that if we have a transition
		// A --x--> B, and A is unreachable (so we want to remove it), and there is no other transition into B,
		// then B must also be unreachable and we should delete it too.
		this.cleanupState(toState)
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
	
	cleanupState (stateToDelete) {
		// There is no evidence yet that the passed state is unreachable. It might be part of a longer
		// chain like w in u --> v --> w. But in this case, cleanupState(u) should be called first, and
		// this will recursively induce each of v and w to be cleaned up eventually.
		if (stateToDelete.indegree !== 0 || stateToDelete.isStartState) {
			return
		}
		
		// Since this state is unreachable, the transitions eminating from it will never be followed and
		// so can be removed
		Object.entries(stateToDelete.transitions).forEach(([transitionSymbol, childStates]) => {
			for (let childState of childStates) {
				this.unregisterTransition(stateToDelete, transitionSymbol, childState)
			}
		})
		
		// Now that this state has both zero outdegree and zero indegree, it is safe to remove it completely
		// from the NFA object, so it will be garabage collected soon (as long as the programmer has not created
		// a reference to it somewhere else)
		this.stateSet.delete(stateToDelete)
	}
	
	// TODO: use this method more in regex_parse.js
	transferStartState (formerStartState, newStartState) {
		if (!formerStartState.isStartState) {
			throw new Error("Tried to transfer the start state away from a state which is not actually the current start state")
		}
		
		formerStartState.isStartState = false
		newStartState.isStartState = true
		this.startState = newStartState
	}
    
	/**
	 * Take all the transitions out of otherState and add them to targetState's transitions.
	 *
	 * This is intended to be called only when otherState and targetState are deemed to be equivalent states (any input will lead
	 * to the same outcome if you start in either state) - and for this reason, otherState and targetState must either both be
	 * accepting states or both be non-accepting states. (Since otherwise they would not behave equivalently on an empty input).
	 *
	 * IMPORTANT: it is the responsibility of the caller to finally disconnect otherState from targetState. This method only moves all
	 * the transitions across.
	 */
	mergeStates (otherState, targetState) {
		// Part of the merging process is merging the fact that this is an accepting state
		if (otherState.isAcceptingState) {
			targetState.isAcceptingState = true
		}
		
		for (let [transitionSymbol, otherChildren] of Object.entries(otherState.transitions)) {
			for (let otherChild of otherChildren) {
				// Create a connection directly between targetState and otherChild, bypassing otherState
				// but first, we want to carefully handle the case were this transition is a self-transition
				// from otherState to itself. In that case, since we're assuming targetState and otherState are equivalent
				// we can replace otherChild with targetState. This is important because otherwise it's possible that even after the
				// merge there would still be a transition from targetState to otherState that would be dangerous to remove.
				const fixedOtherChild = (otherChild === otherState) ? targetState : otherChild
				this.registerTransition(targetState, transitionSymbol, fixedOtherChild)
			}
		}
		
		// Now that targetState has all of the former start state's transitions, it can behave just as the start
		// state did. But we're not allowed to delete the start state because that would leave the NFA in an invalid state.
		// So we must transfer the start state.
		if (otherState.isStartState) {
			this.transferStartState(otherState, targetState)
		}
	}
	
    // If A --x--> B --(null)--> C, then to remove the null transition
    // we must create a transition A --x--> C, and then eliminate the transition
    // B --(null)--> C
    eliminateNullTransitions () {
		console.log("Eliminating null transitions")
		// Note that although this.stateSet is mutated by the callback function provided, this is okay
		// because 23.2.3.6 of the ECMA specification guarantees that new items added to the set will still
		// be traversed.
		this.stateSet.forEach(state => {
			let nullChildren; // the set of states which are just an epsilon-transition away from the current state
			
			while ((nullChildren = state.getNextStates("")).size) {
				/**
				console.log("null children at the moment are", Array.from(nullChildren))
				for (let nullChild of nullChildren) {
					// Create a connection directly between 'state' and each child of 'nullChild'.
					// We will refer to each child of nullChild with the name 'nullChildChild'
					// It is okay if the transitionSymbol is itself a null transition, because this is
					// all being done in a while loop and will continue until there are no more null transitions
					// from this state.
					Object.entries(nullChild.transitions).forEach(([transitionSymbol, nullChildChildren]) => {
						for (let nullChildChild of nullChildChildren) {
							this.registerTransition(state, transitionSymbol, nullChildChild)
							console.log("Connecting", state, "with", nullChildChild, "via", transitionSymbol, "for null elimination")
						}
					})
					
					// Now that we have all the connections, we don't need a  null transition to nullChild anymore.
					this.unregisterTransition(state, "", nullChild)
				}
				*/
				
				for (let nullChild of nullChildren) {
					console.log("Merging", nullChild, "and", state)
					this.mergeStates(nullChild, state)
					this.unregisterTransition(state, "", nullChild)
				}
			}
		})
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
				node.graphNode = new GraphNode(xCoord, yCoord, node.isAcceptingState ? "pink" : "orange")

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
    constructor (humanName, isStartState, isAcceptingState, transitions = {}, indegree = 0) {
        this.humanName = humanName
        this.isStartState = isStartState
        this.isAcceptingState = isAcceptingState
        this.transitions = transitions
		this.indegree = indegree
    }
    
    getNextStates (inputSymbol) {
        if (!this.transitions.hasOwnProperty(inputSymbol)) {
            return new Set();
        } else {
            return this.transitions[inputSymbol]
        }
    }
}
