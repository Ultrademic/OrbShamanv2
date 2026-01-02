
import { Vector3 } from 'three';

export enum AgentState {
  IDLE = 'IDLE',
  MOVE = 'MOVE',
  GATHER = 'GATHER',
  BUILD = 'BUILD',
  WANDER = 'WANDER'
}

export interface SphericalPos {
  phi: number; // Polar angle (0 to PI)
  theta: number; // Azimuthal angle (0 to 2PI)
}

export interface Entity {
  id: string;
  position: Vector3;
}

export interface Tree extends Entity {
  health: number;
  maxHealth: number;
}

export interface Building extends Entity {
  type: 'HUT';
  progress: number; // 0 to 100
  isComplete: boolean;
  assignedWorkers: string[];
}

export interface Follower extends Entity {
  state: AgentState;
  targetId: string | null;
  targetPos: Vector3 | null;
  woodCarrying: number;
}

export interface GameState {
  wood: number;
  maxWood: number;
  population: number;
  maxPopulation: number;
}
