import {GraphNode, GraphEdge} from './graphRenderer.js'
import {invertMap} from './util.js'

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
export class NFA {
    constructor (startState, stateSet, alphabet, isDFA = false) {
        this.startState = startState
        this.stateSet = new Set(stateSet)
        this.alphabet = new Set(alphabet)
		this.visitHistory = new Map()
		this.pumpingInterval = null
		this.symbolNumber = 0; // position into the input stream
		
        this.reset() // go to the start state
        
        if (!this.startState.isStartState) {
            throw new Error("Start state is not marked as a start state in NFA")
        }
    }
    
    registerTransition (fromState, inputSymbol, toState) {
        fromState.transitions[inputSymbol] ||= new Set() // if not yet defined, create it
		toState.inverseTransitions[inputSymbol] ||= new Set()
		
		if (!fromState.transitions[inputSymbol].has(toState)) {
			toState.indegree++
			fromState.transitions[inputSymbol].add(toState)
		}
		
		if (!toState.inverseTransitions[inputSymbol].has(fromState)) {
			toState.inverseTransitions[inputSymbol].add(fromState)
		}
    }
    
    unregisterTransition (fromState, inputSymbol, toState) {
		if (fromState.transitions.hasOwnProperty(inputSymbol)) {
			if (fromState.transitions[inputSymbol].has(toState)) {
				toState.indegree--
				fromState.transitions[inputSymbol].delete(toState)
				toState.inverseTransitions[inputSymbol].delete(fromState)
				//debugger;
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
		this.redrawCurrentStates()
    }
    
    handleNullTransitions () {
        const stateQueue = [...this.currentStates]
        
		let thisState;
        while (thisState = stateQueue.pop()) {
            thisState.getNextStates("").forEach(nextState => {
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
		console.log("A state was removed, so there are now", this.stateSet.size)
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
		console.log("Request to merge", otherState, "into", targetState)
		// Validate to make sure we're not trying to merge a state into itself
		if (otherState === targetState) {
			console.log("Tried to merge state into itself")
			return
		}
		
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
					console.log("Eliminated null transition between", state, "and", nullChild)
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
					
					console.log("Code for state", state, "is", code)
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
				node.graphNode = new GraphNode(xCoord, yCoord, node.isAcceptingState, node.isStartState, this.currentStates.has(node))

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
	static idNum = 0
	
    constructor (humanName, isStartState, isAcceptingState, transitions = {}, inverseTransitions = {}, indegree = 0) {
        this.humanName = humanName
        this.isStartState = isStartState
        this.isAcceptingState = isAcceptingState
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