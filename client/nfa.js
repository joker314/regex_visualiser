import {GraphNode, GraphEdge} from './graphRenderer.js'
import {invertMap} from './util.js'
import {enumerate} from './util/iteration.js'


/**
 * A non-deterministic finite state automaton is a kind
 * of finite directed graph which represents the computational
 * process of deciding a regular language.
 */
export class NFA {
    constructor (startState, stateSet, alphabet, shouldErrorOnForeignSymbol = false) {
        this.startState = startState
        this.stateSet = new Set(stateSet)
        this.alphabet = new Set(alphabet)
		this.visitHistory = new Map()
		this.shouldErrorOnForeignSymbol = shouldErrorOnForeignSymbol
		
		// The pumping interval is an array of two numbers, (A, B). This
		// indicates that it is possible to apply the pumping lemma to the substring
		// between input position A and input position B in the input stream.
		// The pumping interval is null when the pumping lemma doesn't apply.
		this.pumpingInterval = null
		
		// Go to the start state, record the position into the input stream as 0,
		// and other initialisation is done in the .reset() method. This is because it might
		// need to be called again later, after some processing has already been done on the NFA instance.
        this.reset()
        
		// Part of the point of having this wrapper class for NFAs is to make sure the state of the NFA is consistent
		// by ensuring the selected start state actually claims to be a start state.
        if (!this.startState.isStartState) {
            throw new Error("Start state is not marked as a start state in NFA")
        }
    }
    
	/**
	 * Each NFAState is responsible for maintaining its inward and outward connections. However,
	 * the purpose of this method in the wrapping NFA is to make it a single method call in order to
	 * create a new transition. This involves many small tasks, such as:
	 *  - registering an incoming transition with the destination state
	 *  - registering an outgoing transition with the source state
	 *  - increasing the indegree and outdegree counters, where necessary
	 *  - initialising transition tables for states if they don't already have them
	 * in general, it requires notifying both of the states of the intended change.
	 */
    registerTransition (fromState, inputSymbol, toState) {
		// Create a set of outgoing and incoming transitions for a state if it's not yet defined.
		// The ??= is a very readable and common pattern for only creating it if it doesn't already exist
        fromState.transitions[inputSymbol] ??= new Set() // if not yet defined, create it
		toState.inverseTransitions[inputSymbol] ??= new Set()
		
		// If the incoming connection to the destination state hasn't already been registered, then register it
		// and increase the destination's indegree
		if (!fromState.transitions[inputSymbol].has(toState)) {
			toState.indegree++
			fromState.transitions[inputSymbol].add(toState)
		}
		
		// Similarly for the outward connection from the source state
		if (!toState.inverseTransitions[inputSymbol].has(fromState)) {
			toState.inverseTransitions[inputSymbol].add(fromState)
		}
    }
    
	/**
	 * See registerTransition for the sorts of tasks that need to be done when removing a transition between
	 * two states. It requires notifying both states of the intended change.
	 */
    unregisterTransition (fromState, inputSymbol, toState) {
		// Check to see that
		//  i) there is at least one outward connection from the source state
		//     so that we don't attempt to access a non-existent data structure,
		//     which would lead to an error
		if (fromState.transitions.hasOwnProperty(inputSymbol)) {
			// and ii) one of those outward connections is to the destination state,
			//         such that the transition we are trying to remove actually exists
			if (fromState.transitions[inputSymbol].has(toState)) {
				// Mark that the destination state has less incoming connections now
				toState.indegree--
				
				// Tell the states on both ends that the connection should no longer exist
				fromState.transitions[inputSymbol].delete(toState)
				toState.inverseTransitions[inputSymbol].delete(fromState)
			}
			
			// If this causes there to be no more transitions across this symbol
			// from that state, then remove the entry in the state's transition table
			
			// This involves deleting the Set so that it can be garbage collected, thus saving on the underlying
			// memory used by the Set data structure internally by JavaScript
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
    
	/**
	 * The NFA is responsible for keeping track of the states it is currently in. (For a DFA, it is always
	 * in 1 state - or somtimes 0 if there is no trap state).
	 *
	 * This function will take in ONE input symbol and update its state accordingly.
	 *
	 * This means that in order to read in an entire input, one must call this method for each symbol of the input
	 * in turn.
	 */
    readSymbol (inputSymbol) {
        if (!this.alphabet.has(inputSymbol)) {
			// If the input symbol isn't even in the alphabet (i.e. the character was never
			// used in the regular expression), then it is sometimes helpful to throw an error.
			// We leave this as something configurable for the user.
            if (this.shouldErrorOnForeignSymbol) {
				throw new Error("NFA read a symbol of " + inputSymbol + " which isn't even in the alphabet")
			} else {
				// Since there cannot possibly be outgoing transitions for symbols outside the alphabet,
				// we know that we can just set the NFA's state to the empty set
				this.currentStates = new Set()
			}
        } else {
			// Otherwise, we should calculate the next set of states.
			// In a DFA, this will be a set of size 1.
			
			// Use [...x] to convert to an array. This is because sets don't have flatMap capabilities
			// At the end, convert back to a set
			this.currentStates = new Set(
				// The below process converts each item into an array. flatMap additionally merges
				// each of these arrays into a single, one-dimensional (i.e. "flat") array, which allows
				// for easier further processing
				[...this.currentStates].flatMap(
					// Replace each state with an array of next states
					currentState => [...currentState.getNextStates(inputSymbol)]
				)
			)
		}
		
		// Although the end application does not use null transitions, this library might be used by other
		// applications in the future which do try to simulate the progression of epsilon-NFAs.
		// TODO: actually add a dropdown for all the options?
		this.handleNullTransitions()
		
		// Now that we've read a symbol, 
		this.redrawCurrentStates()
    }
    
	/**
	 * In an epsilon-NFA, it is possible for there to be a transition between two states that is labelled
	 * with the empty symbol (epsilon). This means that it is possible to move from one state to the other without having
	 * read any particular symbol.
	 *
	 * Thus, if after some operation the NFA finds itself in state A, and state A has an outward transition to state B along
	 * epsilon, then the NFA must also enter state B at the same time.
	 *
	 * This method should be called whenever the state the NFA is in changes, and it is responsible for finding the destinations
	 * of these epsilon transitions, and entering them.
	 */
    handleNullTransitions () {
		// TODO: use an actual stack
		// This keeps track of the states that we need to check
		// They might have outward epsilon transitions
        const stateQueue = [...this.currentStates]
        
		// Keep taking a state from the stateQueue...
		let thisState;
        while (thisState = stateQueue.pop()) {
			// ...and checking all the states reachable from it along a single epsilon transition...
            thisState.getNextStates("").forEach(nextState => {
                if (!this.currentStates.has(nextState)) {
					// Enter the destination state
                    this.currentStates.add(nextState)
					
					// There is a possibility of a chain reaction, for example if
					// we start in state A and the transitions are:
					//   A -> B -> C
					// then once we enter state B, we suddenly have another epsilon transition
					// and so we add this to the queue to be processed later, so that we can move
					// into state C at a later iteration.
                    stateQueue.push(nextState)
                }
            })
        }
    }
	
	/**
	 * Safely disposes of a state that is unreachable.
	 * An unreachable state is one that cannot be reached from the start state after reading
	 * a finite number of symbols.
	 *
	 * In the case of a longer chain like u -> v -> w, where u is unreachable, it is true that each
	 * of u, v, and w are all unreachable. However, this method must be called with the earliest such state,
	 * which is u. This method will then recursively clean up both v and w.
	 */
	cleanupState (stateToDelete) {
		// A state is unreachable if it has no incoming connections from other states
		// However, the start state is a special case because no matter what the start state is reachable,
		// because it's the state we are automatically in it at the start (and have therefore immediately reached it)
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
	// TODO: defensive programming, are these in the state set?
	/**
	 * Safely changes the start state of this NFA from one state to another.
	 */
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
		// Validate to make sure we're not trying to merge a state into itself
		if (otherState === targetState) {
			return
		}
		
		// Part of the merging process is merging the fact that this is an accepting state
		if (otherState.isAcceptingState) {
			targetState.isAcceptingState = true
		}
		
		for (let [transitionSymbol, otherChildren] of Object.entries(otherState.transitions)) {
			for (let otherChild of otherChildren) {
				// At the moment, the connection looks like this:
				//   otherState -(a)-> otherChild
				// We want to create a similar transition, but from targetState. This is because
				// by merging otherState into targetState, we are copying over all of its transitions to other states.
				// So we want:
				//   targetState -(a)-> otherChild
				// However, there is a subtle point which is where otherChild === otherState. In other words, the originalState
				// transition looked like this, a self-loop:
				//   otherState -(a)-> otherState
				// but we don't want the transition from targetState to map to otherState, because we're planning to delete
				// otherState. Instead, since we consider targetState to be equivalent to otherState (as we're merging them),
				// we should imagine that the original transition actually looked like this:
				//   otherState -(a)-> targetState
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
    eliminateNullTransitions (states = this.stateSet) {
		// Note that although this.stateSet is mutated by the callback function provided, this is okay
		// because 23.2.3.6 of the ECMA specification guarantees that new items added to the set will still
		// be traversed.
		states.forEach(state => {
			let nullChildren; // the set of states which are just an epsilon-transition away from the current state
			
			while ((nullChildren = state.getNextStates("")).size) {				
				for (let nullChild of nullChildren) {
					this.mergeStates(nullChild, state)
					this.unregisterTransition(state, "", nullChild)
				}
			}
		})
    }
	
	/**
	 * Make sure that the entry in every transition is a set of size exactly 1.
	 * If currently the sets are bigger, we merge them.
	 */
    makeDFA () {
		// https://www.javatpoint.com/automata-conversion-from-nfa-to-dfa
		const unprocessedStates = []
		
		const newStartState = new NFAState("DFA start", true, this.startState.isAcceptingState)
		newStartState.originalStates.push(this.startState)
		
		const newDFA = new NFA(newStartState, [newStartState], this.alphabet) // TODO: alphabet may shrink with unreachable states
		const statesToProcess = [newStartState]
		
		// TODO: use a real hashtable
		const hashTable = {}
		hashTable[newStartState.hashOriginalStates()] = newStartState
		
		// TODO: switch to queue
		// TODO: consider making sure each state is created once, where states can be distinguished by
		// their originalStates array
		while (statesToProcess.length) {
			const currentState = statesToProcess.pop()
			console.log("Now processing", currentState)
			
			for (let symbol of this.alphabet) {
				const stateCombinations = []
				
				for (let originalState of currentState.originalStates) {
					for (let otherState of originalState.getNextStates(symbol)) {
						 stateCombinations.push(otherState)
					}
				}
				
				if (stateCombinations.length) {
					const isAcceptingState = stateCombinations.some(state => state.isAcceptingState)
					
					let nextState = new NFAState("", false, isAcceptingState)
					nextState.originalStates = stateCombinations
					
					if (!hashTable.hasOwnProperty(nextState.hashOriginalStates())) {
						hashTable[nextState.hashOriginalStates()] = nextState
						statesToProcess.unshift(nextState) // TODO: not good complexity, always push to end!
					}
					
					nextState = hashTable[nextState.hashOriginalStates()] // make sure we don't create this state again later
					
					newDFA.registerTransition(currentState, symbol, nextState)
					newDFA.stateSet.add(nextState)
				}
			}
		}
		
		console.log("Hash table keys are", Object.keys(hashTable))
		return newDFA
	}
	
	minimizeDFA () {
		// https://www.geeksforgeeks.org/minimization-of-dfa/
		
		// All the states that are accepting states are definitely different to the non-accepting states.
		// So we begin by using that as the partition criteria.
		let currentPartition = new Partition(this.stateSet, state => state.isAcceptingState)
		let dirty = true
		
		// First, find out which states can be merged into one
		while (dirty) {
			dirty = false // if there are no changes made in this iteration, dirty will stay false and we will exit the loop
			
			for (let stateSet of currentPartition.collectionOfSets) {
				// Currently, stateSet is thought to be a set of indistinguishable states.
				// We should try to refine this by finding pairs of states that behave differently
				// for the same input symbol.
				
				// Each state can be given a code. The jth character in the ith code says whether or not
				// states i and j are distinguishable. Two states need to have exactly the same codes in order
				// to continue being in the same set of the partition.
				const subPartition = new Partition(stateSet, state => {
					let code = ''
					
					for (let otherState of stateSet) {
						if (currentPartition.canDistinguish([...this.alphabet], state, otherState)) {
							code += 'Y'
						} else {
							code += 'N'
						}
					}
					
					return code
				})
				
				// Check if this new partition is actually different to the old partition. If it is, then
				// update the partition and set dirty to true again
				if (!subPartition.isTrivial()) {
					dirty = true
					
					currentPartition.removeSet(stateSet)
					for (let subSet of subPartition.collectionOfSets) {
						currentPartition.addSet(subSet)
					}
				}
				
				console.log("Layout is", [...currentPartition.collectionOfSets].map(set => set.size))
			}
		}
		
		// Now create a new DFA which merges all the states that have been determined to be indistinguishable
		const getMergedState = new Map()
		
		// TODO: make currentPartition an iterator to avoid this clunky reference
		for (let set of currentPartition.collectionOfSets) {
			const isStartState = [...set].some(state => state.isStartState)
			const isAcceptingState = [...set].some(state => state.isAcceptingState)

			getMergedState.set(set, new NFAState("", isStartState, isAcceptingState))
		}
		
		console.log("Partition is", currentPartition)
		
		const mergedStartState = singleStateToMerged(this.startState)
		const minimizedDFA = new NFA(mergedStartState, getMergedState.values(), this.alphabet)
		
		// TODO: refactor partitions to make this easier
		function singleStateToMerged (singleState) {
			return getMergedState.get(currentPartition.stateToID.get(singleState))
		}
		
		for (let state of this.stateSet) {
			for (let [transitionSymbol, childStates] of Object.entries(state.transitions)) {
				const mergedOrigin = singleStateToMerged(state)
				const mergedDestination = singleStateToMerged([...childStates][0]) // it's a DFA, so only one child state
				console.log("Current map is", currentPartition.stateToID)
				console.log("Current partition is", currentPartition)
				console.log("So", currentPartition.stateToID.get([...childStates][0]))
				
				if (this.stateSet.has([...childStates][0])) {
					console.log("ok")
				} else {
					console.error("not ok")
				}
				
				console.log("Important thing is", singleStateToMerged([...childStates][0]))
				minimizedDFA.registerTransition(mergedOrigin, transitionSymbol, mergedDestination)
			}
		}
		
		return minimizedDFA
	}
	
    // Determines whether or not the NFA is in an accepting state. Usually called once all
	// the input has been consumed -- but doesn't have to be.
    finished () {
        return Array.from(this.currentStates).some(currentState => currentState.isAcceptingState)
    }
	
	// TODO: rename to reflect wider use case
	redrawCurrentStates () {
		if (this.startState.graphNode) { // TODO: this should be a property of the NFA not of the start state
			for (let state of this.stateSet) {
				state.graphNode.isActive = this.currentStates.has(state)
			}
		}
		
		if (!this.pumpingInterval) {
			for (let state of this.currentStates) {
				if (this.visitHistory.has(state)) {
					this.pumpingInterval = [this.visitHistory.get(state), this.symbolNumber]
				} else {
					this.visitHistory.set(state, this.symbolNumber)
				}
			}
		}
		
		this.symbolNumber++;
	}
    
    reset () {
        this.currentStates = new Set([this.startState])
		this.redrawCurrentStates()
		this.visitHistory.clear()
		this.symbolNumber = 0
		
		// TODO: only run this when needed
		this.handleNullTransitions()
    }
	
	addTrapState () {
		const trapState = new NFAState("trap state", false, false, {}, {}, 0, true)
		this.stateSet.add(trapState)
		
		
		// Add a transition from every other state to the trap state
		// This includes a transition from the trap state to itself
		for (let otherState of this.stateSet) {
			for (let transitionSymbol of this.alphabet) {
				// Make sure the state doesn't have a valid transition along that symbol
				if (!otherState.getNextStates(transitionSymbol).size) {
					this.registerTransition(otherState, transitionSymbol, trapState)
				}
			}
		}
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
				node.graphNode = new GraphNode(
					xCoord,
					yCoord,
					node.isAcceptingState,
					node.isStartState,
					this.currentStates.has(node),
					node.isTrapState,
					node.isTrapState ? "brown" : "orange"
				)

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
					edgeObjects.push(new GraphEdge(node.graphNode, childNode.graphNode, transitionSymbol))
				}
			}
		})

		return [nodeObjects, edgeObjects]
    }
}

export class NFAState {
	// Give each NFAState a unique ID so that it can be hashed
	// for use in other data structures
	static idNum = 0
	
	// TODO: reorder so that isTrapState is earlier?
    constructor (humanName, isStartState, isAcceptingState, transitions = {}, inverseTransitions = {}, indegree = 0, isTrapState = false) {
        this.humanName = humanName
        this.isStartState = isStartState
        this.isAcceptingState = isAcceptingState
		this.isTrapState = isTrapState
        this.transitions = transitions
		this.inverseTransitions = inverseTransitions
		this.indegree = indegree
		this.id = NFAState.idNum++
		
		// For DFA states:
		// TODO: rename to be more clear
		this.originalStates = []
    }
    
    getNextStates (inputSymbol) {
        if (!this.transitions.hasOwnProperty(inputSymbol)) {
            return new Set();
        } else {
            return this.transitions[inputSymbol]
        }
    }
	
	// TODO: rename? make subclass for DFA states?
	hashOriginalStates () {
		return [...new Set(this.originalStates)].map(state => state.id).sort().join(" ")
	}
}

class Partition {
	constructor (states, indicator) {
		this.collectionOfSets = new Set()
		this.stateToID = new Map() // maps to sets, which are objects and so always unique
		
		const indicationToSet = new Map()
		
		for (let state of states) {
			const indication = indicator(state) // compute here once in case indicator is an expensive call
			
			if (!indicationToSet.has(indication)) {
				indicationToSet.set(indication, new Set())
			}
			
			indicationToSet.get(indication).add(state)
		}
		
		// Add the sets one at a time, making sure to make an entry in the lookup table as we go:
		for (let set of indicationToSet.values()) {
			this.addSet(set)
		}
	}
	
	removeSet (set) {
		this.collectionOfSets.delete(set)
		
		for (let state of set) {
			this.stateToID.delete(state)
		}
	}
	
	addSet (set) {
		this.collectionOfSets.add(set)
		console.log("Given set is", set)
		
		for (let state of set) {
			this.stateToID.set(state, set) // sets are objects, so are unique, and so can be used as IDs
		}
	}
	
	canDistinguish (alphabet, stateA, stateB) {
		console.log("Using", alphabet, "as the alphabet")
		return alphabet.some(symbol => {
			const stateAChild = [...stateA.getNextStates(symbol)][0]
			const stateBChild = [...stateB.getNextStates(symbol)][0]
			console.log("Under", symbol, "A's next state is", stateAChild, "but B's next state is", stateBChild)
			return this.stateToID.get(stateAChild) !== this.stateToID.get(stateBChild)
		})
	}
	
	isTrivial () {
		return this.collectionOfSets.size < 2
	}
	
	static fromPredicate (states, predicate) {
		const ifYes = new Set()
		const ifNo = new Set()
		
		for (let state of states) {
			if (predicate(state)) {
				ifYes.add(state)
			} else {
				ifNo.add(state)
			}
		}
		
		return new Partition([ifYes, ifNo])
	}
}