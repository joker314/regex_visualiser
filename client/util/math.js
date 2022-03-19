// Computes a uniformly random number in the interval [lower, upper]
export function random(lower, upper) {
	const rangeSize = upper - lower
	
	return lower + Math.random() * rangeSize
}

// TODO: should this be public?
// Performs a weighted average of two real numbers, which is used for linear interpolation of coordinates
export function average(a, b, weight = 0.5) {
	const antiweight = 1 - weight
	
	return (weight * a) + (antiweight * b)
}

/**
 * Given the start point, control points, and end points (passed as the list points),
 * and a parameter 0 <= t <= 1, returns a point on the curve. Calculated recursively.
 */
export function bezier(points, t) {
	// Base case: just one point
	// The answer will always be that point regardless of the parameter t
	if (points.length === 1) {
		return points[0]
	}
	
	// Create the next layer of points (called 'nextPoints') which will eventually have a length one fewer
	// than the current layer of 'points'
	const nextPoints = []
	
	// It's points.length - 1 not points.length because we will be considering pairs of points at positions
	// [x, x+1]. So it must be the case that (x+1) is always an in-range index.
	for (let i = 0; i < points.length - 1; i++) {
		const point = points[i]
		const nextPoint = points[i + 1]
		
		// Interpolate adjacent points along the current Bezier curve and add the resulting point to the next layer of points
		const interpolatedPoint = new Point(average(point.x, nextPoint.x, t), average(point.y, nextPoint.y, t))
		nextPoints.push(interpolatedPoint)
	}

	// Recursively call the function on this smaller layer.
	// Guaranteed to reach base case and halt eventually, because size of the first parameter is decreasing by 1 each call
	// and so will become 0 at some point
	return bezier(nextPoints, t)
}