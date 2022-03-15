export function enumerate (arr) {
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

// Computes the Cartesian product of two sets
export function* product (A, B) {
	for (let aItem of A) {
		for (let bItem of B) {
			yield [aItem, bItem]
		}
	}
	return
}