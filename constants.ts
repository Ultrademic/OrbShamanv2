
import * as THREE from 'three';
import { BuildingType } from './types';

export const PLANET_RADIUS = 20;
export const TREE_COUNT = 40;
export const INITIAL_FOLLOWERS = 5;

export const BUILDING_STATS: Record<BuildingType, { cost: number; label: string; description: string }> = {
  HUT: { cost: 200, label: 'Hut', description: 'Increases population cap.' },
  WARRIOR_HUT: { cost: 400, label: 'Training Hut', description: 'Trains followers into warriors.' },
  TOWER: { cost: 300, label: 'Guard Tower', description: 'Defensive structure (Coming Soon).' },
  TEMPLE: { cost: 1000, label: 'Temple', description: 'Unlock powerful Shaman spells.' },
};

export const HUT_COST = 200; // Deprecated but kept for compatibility in current logic
export const CHOP_STRENGTH = 0.5;
export const BUILD_STRENGTH = 0.2;
export const AGENT_SPEED = 0.15;
export const INTERACTION_RANGE = 1.5;
export const GROWTH_RATE = 0.05; // Followers per second per hut
export const WOOD_CAPACITY = 20; 

// Fixed home base location on the "north pole" for this prototype
export const BASE_POSITION = new THREE.Vector3(0, PLANET_RADIUS, 0);
