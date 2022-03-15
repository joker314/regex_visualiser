import {Point} from './vector.js'

export function random(lower, upper) {
	const rangeSize = upper - lower
	
	return lower + Math.random() * rangeSize
}

export function average(a, b, weight = 0.5) {
	const antiweight = 1 - weight
	
	return (weight * a) + (antiweight * b)
}

/**
 * So we have that P_t = t * (t * P_0 + (1 - t) * P_1) + (1 - t) * (t * P_1 + (1 - t) * P_2)
 * TODO
 */
// TODO: oop this?
export function bezier(points, t) {
	if (points.length === 1) {
		return points[0]
	}
	
	const nextPoints = []
	
	// loop iteration one smaller since we are considering pairs of adjacent points
	for (let i = 0; i < points.length - 1; i++) {
		const point = points[i]
		const nextPoint = points[i + 1]
		
		const interpolatedPoint = new Point(average(point.x, nextPoint.x, t), average(point.y, nextPoint.y, t))
		nextPoints.push(interpolatedPoint)
	}
	
	return bezier(nextPoints, t)
}

export function invertMap (obj) {
	const inverseObj = {}
	
	for (let [key, value] of Object.entries(obj)) {
		if (!inverseObj.hasOwnProperty(value)) {
			inverseObj[value] = new Set()
		}
		
		inverseObj[value].add(key)
	}
}

// TODO: consider implementing by subclassing Set?
export function setsEqual(setA, setB) {
	// Check that set A and B have the same size
	if (setA.size !== setB.size) {
		return false
	}
	
	// Check that set A is a subset of set B
	return Array.from(setA).every(aItem => setB.has(aItem))
}