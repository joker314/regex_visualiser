/**
 * An implementation of a linked list, with a modification to contain
 * a pointer to the end of the list
 */
// TODO: think of a way to abstract away the errors

class DoublyLinkedList {
	static EMPTY_LIST; // will be given a value later
	
	/**
	 * Constructs a linked list from a head and a tail
	 */
	constructor (head, tail) {
		this.isEmpty = false
		this.value = head
		this.next = tail
		this.prev = null
		
		// If `tail` is empty, then the constructed list is of length 1 and the head is also
		// the last element. If instead `tail` has some elements, then the last element
		// of the constructed list will be the same as the last element of the `tail` list.
		this.end = tail?.end ?? this
		
		// The head of `tail` is now no longer the first element in this list. Instead, this node is.
		if (tail) {
			tail.prev = this
		}
	}
	
	/**
	 * Converts a linked list instance into an empty list
	 * This is a method which is only called by a static initialisation
	 * block in order to create LinkedList.EMPTY_LIST
	 * TODO: check if this is needed?
	 */
	makeEmpty () {
		this.isEmpty = true
		this.value = null
		this.next = null
		this.prev = null
		this.end = null
	}
	
	/**
	 * Constructs the only empty list which will ever exist, and
	 * adds it as a class attribute LinkedList.EMPTY_LIST
	 */
	static {
		this.EMPTY_LIST = new LinkedList(null, null)
		this.EMPTY_LIST.makeEmpty()
	}
	
	/**
	 * Determines whether or not the list is empty
	 */
	isEmpty () {
		return this.isEmpty
	}
	
	/**
	 * Returns the value of the first element in the list
	 * (Equivalent to 'car' in Scheme)
	 */
	head () {
		if (this.isEmpty()) {
			throw new Error("Cannot get head() of an empty list")
		}
		
		return this.value
	}
	
	/**
	 * Returns a linked list of all the elements, excluding the first element in the list
	 * (Equivalent to 'cdr' in Scheme)
	 */
	tail () {
		if (this.isEmpty()) {
			throw new Error("Cannot get head() of an empty list")
		}
		
		return this.next
	}
	
	/**
	 * Removes this node from the linked list
	 * It is important for the caller to maintain a reference to a different node in the linked list,
	 * if it wants to reference this linked list in the future.
	 *
	 * Returns a reference to the removed node
	 */
	unlink () {
		// There's no need for a temporary third variable because we're not modifying this.prev
		// or this.next directly. Instead, we're modifying their properties.
		if (this.prev) {
			this.prev.next = this.next
		}
		
		if (this.next) {
			this.next.prev = this.prev
		}
		
		return this
	}
	
	/**
	 * Places the `newNode` just before the current node
	 * Note: changes newNode.prev and newNode.next, so it is important that
	 * newNode is not already part of an existing list.
	 */
	prepend (newNode) {
		// fix this.prev's pointers
		if (this.prev) {
			this.prev.next = newNode
		}
		
		// fix newNode's pointers
		newNode.prev = this.prev
		newNode.next = this
		
		// fix our own pointers
		this.prev = newNode
	}
}

// XXX: composition over inheritence :)
/**
 * A queue is implemented as a linked list, and supports:
 *  - enqueue operations
 *  - dequeue operations
 *
 * The queue is a first in, first out data structure
 */
class Queue {
	static START_SENTINEL = new Symbol("Start of linked list") 
	/**
	 * Constructs an empty queue, that can be added to with .enqueue()
	 */
	constructor () {
		this.underlyingList = new DoublyLinkedList(Queue.START_SENTINEL, DoublyLinkedList.EMPTY_LIST)
	}
	
	/**
	 * Adds an element to the queue
	 */
	enqueue (value) {
		const linkedListNode = new DoublyLinkedList(value, null)
		
		// Append the value to the end of the list
		// This is a special linked list data structure in which this operation is, unusually, O(1)
		// We want to insert it just before the <empty list> value at the end.
		this.underlyingList.end.prepend(linkedListNode)
	}
	
	/**
	 * Removes an element from the queue, and returns it
	 */
	dequeue () {
		if (this.tail().isEmpty()) {
			throw new Error("Cannot dequeue from an empty queue")
		}
		
		// Return and remove the element that's just after the head
		// The actual head is the START_SENTINEL, which doesn't store a useful value.
		return this.underlyingList.tail().unlink().value
	}
}

/**
 * A stack is implemented as a linked list, and supports:
 *  - pushing onto the stack
 *  - popping off the stack
 *
 * The stack is a last in, first out data structure
 */
class Stack {
	// Constructs an empty stack, that can be added to with .push()
	constructor () {
		this.underlyingList = new LinkedList()
	}
	
	push (value) {
		// Add the value at the beginning of the linked list
		this.underlyingList = new LinkedList(value, this.underlyingList)
	}
	
	pop () {
		const oldHead = this.underlyingList.head()
		
		return oldHead.unlink().value
	}
}