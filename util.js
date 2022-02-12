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

export function bezierDeriv(startX, startY, controlX, controlY, endX, endY) {
	
}