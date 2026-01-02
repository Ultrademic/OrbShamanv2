
import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Sphere, Box, Cone, Cylinder, Trail, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { 
  PLANET_RADIUS, 
  TREE_COUNT, 
  INITIAL_FOLLOWERS, 
  CHOP_STRENGTH, 
  BUILD_STRENGTH, 
  AGENT_SPEED, 
  INTERACTION_RANGE,
  HUT_COST
} from '../constants';
import { AgentState, Tree, Building, Follower } from '../types';
import { getRandomSurfacePos, projectToSurface, moveOnSphere } from '../utils';

// Helper component to align its children to the surface normal
const SurfaceAligned: React.FC<{ position: THREE.Vector3; children: React.ReactNode }> = ({ position, children }) => {
  const quaternion = useMemo(() => {
    const normal = position.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }, [position]);

  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  );
};

interface WorldProps {
  wood: number;
  setWood: React.Dispatch<React.SetStateAction<number>>;
  setPopulation: React.Dispatch<React.SetStateAction<number>>;
  setMaxPopulation: React.Dispatch<React.SetStateAction<number>>;
  isPlacementMode: boolean;
  onPlacedBuilding: () => void;
}

const World: React.FC<WorldProps> = ({ 
  wood, 
  setWood, 
  setPopulation, 
  setMaxPopulation,
  isPlacementMode,
  onPlacedBuilding 
}) => {
  // --- Game State ---
  const [trees, setTrees] = useState<Tree[]>(() => 
    Array.from({ length: TREE_COUNT }, (_, i) => ({
      id: `tree-${i}`,
      position: getRandomSurfacePos(),
      health: 100,
      maxHealth: 100
    }))
  );

  const [buildings, setBuildings] = useState<Building[]>([]);
  
  const [followers, setFollowers] = useState<Follower[]>(() => 
    Array.from({ length: INITIAL_FOLLOWERS }, (_, i) => ({
      id: `follower-${i}`,
      position: getRandomSurfacePos(),
      state: AgentState.WANDER,
      targetId: null,
      targetPos: null,
      woodCarrying: 0
    }))
  );

  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null);

  // --- Interaction Logic ---
  const handlePlanetClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isPlacementMode && ghostPos) {
      setBuildings(prev => [...prev, {
        id: `building-${Date.now()}`,
        position: ghostPos.clone(),
        type: 'HUT',
        progress: 0,
        isComplete: false,
        assignedWorkers: []
      }]);
      onPlacedBuilding();
      return;
    }

    const point = e.point.clone();
    setFollowers(prev => prev.map(f => ({
      ...f,
      state: AgentState.MOVE,
      targetPos: projectToSurface(point),
      targetId: null
    })));
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isPlacementMode) {
      setGhostPos(projectToSurface(e.point.clone(), PLANET_RADIUS));
    }
  };

  const handleEntityClick = (id: string, type: 'TREE' | 'BUILDING') => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setFollowers(prev => prev.map(f => ({
      ...f,
      state: type === 'TREE' ? AgentState.GATHER : AgentState.BUILD,
      targetId: id,
      targetPos: null
    })));
  };

  // --- Simulation Loop ---
  useFrame((_state, delta) => {
    setFollowers(currentFollowers => {
      let changed = false;
      const nextFollowers = currentFollowers.map(f => {
        let nextPos = f.position.clone();
        let nextState = f.state;
        let nextTargetPos = f.targetPos;
        let nextWood = f.woodCarrying;

        if (nextState === AgentState.WANDER) {
          if (!nextTargetPos || nextPos.distanceTo(nextTargetPos) < 1) {
            nextTargetPos = getRandomSurfacePos();
          }
          nextPos = moveOnSphere(nextPos, nextTargetPos, AGENT_SPEED * delta * 5);
        }

        if (nextState === AgentState.MOVE && nextTargetPos) {
          nextPos = moveOnSphere(nextPos, nextTargetPos, AGENT_SPEED * delta * 15);
          if (nextPos.distanceTo(nextTargetPos) < 0.5) {
            nextState = AgentState.WANDER;
            nextTargetPos = null;
          }
        }

        if (nextState === AgentState.GATHER && f.targetId) {
          const targetTree = trees.find(t => t.id === f.targetId);
          if (targetTree && targetTree.health > 0) {
            const dist = nextPos.distanceTo(targetTree.position);
            if (dist > INTERACTION_RANGE) {
              nextPos = moveOnSphere(nextPos, targetTree.position, AGENT_SPEED * delta * 15);
            } else {
              setTrees(prev => prev.map(t => t.id === f.targetId ? { ...t, health: Math.max(0, t.health - CHOP_STRENGTH) } : t));
              nextWood += CHOP_STRENGTH;
              if (nextWood >= 20) {
                setWood(prev => prev + nextWood);
                nextWood = 0;
              }
            }
          } else {
            nextState = AgentState.WANDER;
          }
        }

        if (nextState === AgentState.BUILD && f.targetId) {
          const targetBuilding = buildings.find(b => b.id === f.targetId);
          if (targetBuilding && !targetBuilding.isComplete) {
            const dist = nextPos.distanceTo(targetBuilding.position);
            if (dist > INTERACTION_RANGE) {
              nextPos = moveOnSphere(nextPos, targetBuilding.position, AGENT_SPEED * delta * 15);
            } else {
              setBuildings(prev => prev.map(b => {
                if (b.id === f.targetId) {
                  const newProgress = Math.min(100, b.progress + BUILD_STRENGTH);
                  return { ...b, progress: newProgress, isComplete: newProgress >= 100 };
                }
                return b;
              }));
            }
          } else {
            nextState = AgentState.WANDER;
          }
        }

        if (!nextPos.equals(f.position) || nextState !== f.state) changed = true;
        return { ...f, position: nextPos, state: nextState, targetPos: nextTargetPos, woodCarrying: nextWood };
      });

      return changed ? nextFollowers : currentFollowers;
    });

    setTrees(prev => {
      const remaining = prev.filter(t => t.health > 0);
      return remaining.length !== prev.length ? remaining : prev;
    });
  });

  useMemo(() => {
    const completedHuts = buildings.filter(b => b.isComplete).length;
    setMaxPopulation(5 + completedHuts * 3);
    setPopulation(followers.length);
  }, [buildings, followers.length, setMaxPopulation, setPopulation]);

  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#44a" />

      <Sphere 
        args={[PLANET_RADIUS, 64, 64]} 
        onPointerMove={handlePointerMove}
        onClick={handlePlanetClick}
      >
        <meshStandardMaterial 
          color="#3a5a40" 
          roughness={0.8} 
          metalness={0.1}
          flatShading={true}
        />
      </Sphere>

      <Sphere args={[PLANET_RADIUS - 0.2, 64, 64]}>
        <meshStandardMaterial color="#0077be" transparent opacity={0.3} />
      </Sphere>

      {/* Trees */}
      {trees.map(tree => (
        <SurfaceAligned key={tree.id} position={tree.position}>
          <group onClick={handleEntityClick(tree.id, 'TREE')}>
            <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
              {/* Leaves: height 2, pivot at bottom of cone would be [0, 1.5, 0] */}
              <Cone args={[0.6, 2, 8]} position={[0, 1.5, 0]}>
                <meshStandardMaterial color="#386641" />
              </Cone>
              {/* Trunk: height 1, pivot at center. So [0, 0.5, 0] puts base at 0 */}
              <Cylinder args={[0.2, 0.2, 1, 8]} position={[0, 0.5, 0]}>
                <meshStandardMaterial color="#604a32" />
              </Cylinder>
            </Float>
            {tree.health < 100 && (
              <Html distanceFactor={10} position={[0, 3, 0]}>
                <div className="w-12 h-1.5 bg-black/50 border border-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300" 
                    style={{ width: `${tree.health}%` }} 
                  />
                </div>
              </Html>
            )}
          </group>
        </SurfaceAligned>
      ))}

      {/* Buildings */}
      {buildings.map(building => (
        <SurfaceAligned key={building.id} position={building.position}>
          <group 
            onClick={handleEntityClick(building.id, 'BUILDING')}
            scale={building.isComplete ? 1 : 0.5 + (building.progress / 200)}
          >
            {/* Base Box: height 2, pivot at center. So [0, 1, 0] puts base at 0 */}
            <Box args={[3, 2, 3]} position={[0, 1, 0]}>
              <meshStandardMaterial color={building.isComplete ? "#bc6c25" : "#8d99ae"} />
            </Box>
            {/* Roof: height 2, sits on top of box. So [0, 3, 0] */}
            <Cone args={[2.5, 2, 4]} position={[0, 3, 0]} rotation={[0, Math.PI / 4, 0]}>
              <meshStandardMaterial color="#606c38" />
            </Cone>
            
            {!building.isComplete && (
              <Html distanceFactor={12} position={[0, 5, 0]}>
                <div className="flex flex-col items-center">
                  <div className="bg-black/80 px-2 py-1 rounded text-[10px] text-white font-bold mb-1 border border-orange-500/30 whitespace-nowrap">
                    BUILDING: {Math.floor(building.progress)}%
                  </div>
                  <div className="w-24 h-2 bg-black/50 border border-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-300" 
                      style={{ width: `${building.progress}%` }} 
                    />
                  </div>
                </div>
              </Html>
            )}
          </group>
        </SurfaceAligned>
      ))}

      {/* Followers */}
      {followers.map(follower => (
        <SurfaceAligned key={follower.id} position={follower.position}>
          <group>
            <Float speed={5} rotationIntensity={0.5} floatIntensity={0.2}>
              {/* Body: height 0.8, base at 0 -> position [0, 0.4, 0] */}
              <Box args={[0.6, 0.8, 0.4]} position={[0, 0.4, 0]}>
                <meshStandardMaterial color={
                  follower.state === AgentState.GATHER ? "#e63946" : 
                  follower.state === AgentState.BUILD ? "#f4a261" : 
                  "#457b9d"
                } />
              </Box>
              {/* Head: diameter 0.4, sits on top -> position [0, 1.0, 0] */}
              <Sphere args={[0.3]} position={[0, 1.0, 0]}>
                <meshStandardMaterial color="#fefae0" />
              </Sphere>
              {/* Wood Carrying Item */}
              {follower.woodCarrying > 0 && (
                <Box args={[0.2, 0.4, 0.2]} position={[0.4, 0.4, 0]}>
                  <meshStandardMaterial color="#604a32" />
                </Box>
              )}
            </Float>
            <Html distanceFactor={10} position={[0, 1.8, 0]}>
               <span className="text-[8px] bg-black/40 px-1 rounded text-white/70 uppercase whitespace-nowrap">
                 {follower.state}
               </span>
            </Html>
          </group>
        </SurfaceAligned>
      ))}

      {/* Building Ghost (Placement Mode) */}
      {isPlacementMode && ghostPos && (
        <SurfaceAligned position={ghostPos}>
          <group>
            <Box args={[3.2, 2.2, 3.2]} position={[0, 1.1, 0]}>
              <meshStandardMaterial color="#00ff00" transparent opacity={0.3} wireframe />
            </Box>
            <Cone args={[2.7, 2.2, 4]} position={[0, 3.3, 0]} rotation={[0, Math.PI / 4, 0]}>
              <meshStandardMaterial color="#00ff00" transparent opacity={0.2} wireframe />
            </Cone>
          </group>
        </SurfaceAligned>
      )}

      <Sphere args={[100, 32, 32]} inverted>
        <meshBasicMaterial color="#050505" side={THREE.BackSide} />
      </Sphere>
    </group>
  );
};

export default World;
