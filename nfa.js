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
        this.stateSet = stateSet
        this.reset() // go to the start state
        
        if (!this.startState.isStartState) {
            throw new Error("Start state is not marked as a start state in NFA")
        }
    }
    
    registerTransition (fromState, inputSymbol, toState) {
        fromState.transitions[inputSymbol] = toState
    }
    
    readSymbol (inputSymbol) {
        this.currentStates = this.currentStates.flatMap(currentState => currentState.getNextStates(inputSymbol))
    }
    
    // Called when the input has been exhausted
    finish () {
        return this.currentStates.any(currentState => currentState.isAcceptingState))
    }
    
    reset () {
        this.currentStates = [this.startState]
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
            return [];
        } else {
            return this.transitions[inputSymbol]
        }
    }
}
