import { Vector3 } from 'three';
import { PLANET_RADIUS } from './constants';
// Fix: Import SphericalPos from types instead of constants
import { SphericalPos } from './types';

/**
 * Converts spherical coordinates to Cartesian (x, y, z)
 */
export function sphericalToCartesian(phi: number, theta: number, radius: number = PLANET_RADIUS): Vector3 {
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi); // swapping Y and Z for THREE.js standard "Up"
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new Vector3(x, y, z);
}

/**
 * Gets a random position on the sphere surface
 */
export function getRandomSurfacePos(radius: number = PLANET_RADIUS): Vector3 {
  const phi = Math.random() * Math.PI;
  const theta = Math.random() * 2 * Math.PI;
  return sphericalToCartesian(phi, theta, radius);
}

/**
 * Project any vector onto the sphere surface
 */
export function projectToSurface(vec: Vector3, radius: number = PLANET_RADIUS): Vector3 {
  return vec.clone().normalize().multiplyScalar(radius);
}

/**
 * Move point A towards point B along the sphere surface
 */
export function moveOnSphere(current: Vector3, target: Vector3, speed: number): Vector3 {
  const direction = target.clone().sub(current).normalize();
  const next = current.clone().add(direction.multiplyScalar(speed));
  return projectToSurface(next);
}