
import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Sphere, Box, Cone, Cylinder, Ring, Float, Html, Torus } from '@react-three/drei';
import * as THREE from 'three';
import { 
  PLANET_RADIUS, 
  TREE_COUNT, 
  INITIAL_FOLLOWERS, 
  CHOP_STRENGTH, 
  BUILD_STRENGTH, 
  AGENT_SPEED, 
  INTERACTION_RANGE,
  GROWTH_RATE,
  BASE_POSITION,
  WOOD_CAPACITY,
  TOWER_CAPACITY,
  TOWER_RANGE,
  FIRE_RATE,
  PROJECTILE_SPEED
} from '../constants';
import { AgentState, Tree, Building, Follower, BuildingType, FollowerRole, Enemy, Projectile } from '../types';
import { getRandomSurfacePos, projectToSurface, moveOnSphere } from '../utils';

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

const FirewoodPile: React.FC<{ position: THREE.Vector3; seed: number }> = ({ position, seed }) => {
  const rotationOffset = useMemo(() => seed * Math.PI, [seed]);
  return (
    <SurfaceAligned position={position}>
      <group rotation={[0, rotationOffset, 0]}>
        <Cylinder args={[0.08, 0.08, 0.7, 6]} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0.4]}>
          <meshStandardMaterial color="#4a3728" roughness={1} />
        </Cylinder>
        <Cylinder args={[0.08, 0.08, 0.7, 6]} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, -0.6]}>
          <meshStandardMaterial color="#3d2b1f" roughness={1} />
        </Cylinder>
        <Cylinder args={[0.08, 0.08, 0.7, 6]} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#5c4033" roughness={1} />
        </Cylinder>
      </group>
    </SurfaceAligned>
  );
};

interface WorldProps {
  wood: number;
  setWood: React.Dispatch<React.SetStateAction<number>>;
  setPopulation: React.Dispatch<React.SetStateAction<number>>;
  setMaxPopulation: React.Dispatch<React.SetStateAction<number>>;
  isPlacementMode: boolean;
  placementType: BuildingType | null;
  onPlacedBuilding: () => void;
}

const World: React.FC<WorldProps> = ({ 
  wood, 
  setWood, 
  setPopulation, 
  setMaxPopulation,
  isPlacementMode,
  placementType,
  onPlacedBuilding 
}) => {
  const growthTimer = useRef(0);
  const enemySpawnTimer = useRef(0);
  const towerFireTimers = useRef<Record<string, number>>({});
  
  const [selectedFollowerId, setSelectedFollowerId] = useState<string | null>(null);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);

  const woodPilePositions = useMemo(() => {
    const piles: THREE.Vector3[] = [];
    const rings = 6;
    const basePiles = 8;
    for (let r = 1; r <= rings; r++) {
      const radius = 1.0 + r * 0.55;
      const count = basePiles * r;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const offset = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        piles.push(projectToSurface(BASE_POSITION.clone().add(offset)));
      }
    }
    return piles;
  }, []);

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
      role: i === 0 ? FollowerRole.SHAMAN : FollowerRole.WORKER,
      targetId: null,
      targetPos: null,
      woodCarrying: 0
    }))
  );

  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null);

  const handlePlanetClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isPlacementMode && ghostPos && placementType) {
      setBuildings(prev => [...prev, {
        id: `building-${Date.now()}`,
        position: ghostPos.clone(),
        type: placementType,
        progress: 0,
        isComplete: false,
        assignedWorkers: []
      }]);
      onPlacedBuilding();
      return;
    }

    if (selectedFollowerId) {
      const point = projectToSurface(e.point.clone());
      setFollowers(prev => prev.map(f => {
        if (f.id === selectedFollowerId) {
          return { ...f, state: AgentState.MOVE, targetPos: point, targetId: null };
        }
        return f;
      }));
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isPlacementMode) {
      setGhostPos(projectToSurface(e.point.clone(), PLANET_RADIUS));
    }
  };

  const handleEntityClick = (id: string, type: 'TREE' | 'BUILDING') => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const selected = followers.find(f => f.id === selectedFollowerId);
    if (!selected) return;

    if (type === 'BUILDING') {
      const targetBuilding = buildings.find(b => b.id === id);
      if (targetBuilding?.type === 'TOWER' && targetBuilding.isComplete && selected.role === FollowerRole.WARRIOR) {
        if (targetBuilding.assignedWorkers.length < TOWER_CAPACITY) {
          setFollowers(prev => prev.map(f => f.id === selectedFollowerId ? { ...f, state: AgentState.GUARD, targetId: id, targetPos: null } : f));
          setBuildings(prev => prev.map(b => b.id === id ? { ...b, assignedWorkers: [...b.assignedWorkers, selected.id] } : b));
          return;
        }
      }
    }

    setFollowers(prev => prev.map(f => {
      if (f.id === selectedFollowerId) {
        return {
          ...f,
          state: type === 'TREE' ? AgentState.GATHER : AgentState.BUILD,
          targetId: id,
          targetPos: null
        };
      }
      return f;
    }));
  };

  const handleFollowerClick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedFollowerId(id);
  };

  useFrame((state, delta) => {
    // 1. Follower Simulation
    setFollowers(currentFollowers => {
      let changed = false;
      const nextFollowers = currentFollowers.map(f => {
        let nextPos = f.position.clone();
        let nextState = f.state;
        let nextRole = f.role;
        let nextTargetPos = f.targetPos;
        let nextTargetId = f.targetId;
        let nextWood = f.woodCarrying;

        if (nextState === AgentState.WANDER) {
          const distToBase = nextPos.distanceTo(BASE_POSITION);
          if (distToBase > 6) {
            nextPos = moveOnSphere(nextPos, BASE_POSITION, AGENT_SPEED * delta * 10);
          } else {
            if (!nextTargetPos || nextPos.distanceTo(nextTargetPos) < 0.5) {
              const patrolRadius = 4;
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * patrolRadius;
              const offset = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
              nextTargetPos = projectToSurface(BASE_POSITION.clone().add(offset));
            }
            nextPos = moveOnSphere(nextPos, nextTargetPos, AGENT_SPEED * delta * 3);
          }
        }

        if (nextState === AgentState.MOVE && nextTargetPos) {
          nextPos = moveOnSphere(nextPos, nextTargetPos, AGENT_SPEED * delta * 15);
          if (nextPos.distanceTo(nextTargetPos) < 0.5) {
            nextState = AgentState.WANDER;
            nextTargetPos = null;
          }
        }

        if (nextState === AgentState.GATHER && nextTargetId) {
          const targetTree = trees.find(t => t.id === nextTargetId);
          if (targetTree && targetTree.health > 0) {
            const dist = nextPos.distanceTo(targetTree.position);
            if (dist > INTERACTION_RANGE) {
              nextPos = moveOnSphere(nextPos, targetTree.position, AGENT_SPEED * delta * 15);
            } else {
              setTrees(prev => prev.map(t => t.id === nextTargetId ? { ...t, health: Math.max(0, t.health - CHOP_STRENGTH) } : t));
              nextWood += CHOP_STRENGTH;
              if (nextWood >= WOOD_CAPACITY) nextState = AgentState.DELIVER;
            }
          } else {
            nextState = nextWood > 0 ? AgentState.DELIVER : AgentState.WANDER;
            if (nextState === AgentState.WANDER) nextTargetId = null;
          }
        }

        if (nextState === AgentState.DELIVER) {
          const dist = nextPos.distanceTo(BASE_POSITION);
          if (dist > INTERACTION_RANGE) {
            nextPos = moveOnSphere(nextPos, BASE_POSITION, AGENT_SPEED * delta * 15);
          } else {
            setWood(prev => prev + nextWood);
            nextWood = 0;
            nextState = AgentState.WANDER;
            nextTargetId = null;
            nextTargetPos = null;
          }
        }

        if (nextState === AgentState.BUILD && nextTargetId) {
          const targetBuilding = buildings.find(b => b.id === nextTargetId);
          if (targetBuilding && !targetBuilding.isComplete) {
            const dist = nextPos.distanceTo(targetBuilding.position);
            if (dist > INTERACTION_RANGE) {
              nextPos = moveOnSphere(nextPos, targetBuilding.position, AGENT_SPEED * delta * 15);
            } else {
              setBuildings(prev => prev.map(b => {
                if (b.id === nextTargetId) {
                  const newProgress = Math.min(100, b.progress + BUILD_STRENGTH);
                  return { ...b, progress: newProgress, isComplete: newProgress >= 100 };
                }
                return b;
              }));
            }
          } else if (targetBuilding?.isComplete && targetBuilding.type === 'WARRIOR_HUT' && nextRole === FollowerRole.WORKER) {
              nextState = AgentState.TRAIN;
          } else {
            nextState = AgentState.WANDER;
            nextTargetId = null;
          }
        }

        if (nextState === AgentState.TRAIN && nextTargetId) {
            const targetBuilding = buildings.find(b => b.id === nextTargetId);
            if (targetBuilding?.isComplete) {
                const dist = nextPos.distanceTo(targetBuilding.position);
                if (dist > INTERACTION_RANGE) {
                    nextPos = moveOnSphere(nextPos, targetBuilding.position, AGENT_SPEED * delta * 15);
                } else {
                    if (nextRole === FollowerRole.WORKER) nextRole = FollowerRole.WARRIOR;
                    nextState = AgentState.WANDER;
                    nextTargetId = null;
                }
            } else {
                nextState = AgentState.WANDER;
                nextTargetId = null;
            }
        }

        if (nextState === AgentState.GUARD && nextTargetId) {
          const tower = buildings.find(b => b.id === nextTargetId);
          if (tower) {
            const dist = nextPos.distanceTo(tower.position);
            if (dist > 0.1) {
              nextPos = moveOnSphere(nextPos, tower.position, AGENT_SPEED * delta * 15);
            }
            // Logic for shooting is handled in the tower loop
          } else {
            nextState = AgentState.WANDER;
            nextTargetId = null;
          }
        }

        if (!nextPos.equals(f.position) || nextState !== f.state || nextRole !== f.role || nextTargetId !== f.targetId) changed = true;
        return { ...f, position: nextPos, state: nextState, role: nextRole, targetPos: nextTargetPos, targetId: nextTargetId, woodCarrying: nextWood };
      });
      return changed ? nextFollowers : currentFollowers;
    });

    // 2. Tower Combat Logic
    buildings.filter(b => b.type === 'TOWER' && b.isComplete).forEach(tower => {
      const guards = followers.filter(f => f.state === AgentState.GUARD && f.targetId === tower.id);
      if (guards.length > 0) {
        if (!towerFireTimers.current[tower.id]) towerFireTimers.current[tower.id] = 0;
        towerFireTimers.current[tower.id] += delta;

        if (towerFireTimers.current[tower.id] >= FIRE_RATE) {
          const nearestEnemy = enemies.find(e => e.position.distanceTo(tower.position) < TOWER_RANGE);
          if (nearestEnemy) {
            towerFireTimers.current[tower.id] = 0;
            const startPos = tower.position.clone().add(new THREE.Vector3(0, 7, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tower.position.clone().normalize())));
            const dir = nearestEnemy.position.clone().sub(startPos).normalize();
            setProjectiles(prev => [...prev, {
              id: `arrow-${Date.now()}`,
              position: startPos,
              targetId: nearestEnemy.id,
              velocity: dir.multiplyScalar(PROJECTILE_SPEED)
            }]);
          }
        }
      }
    });

    // 3. Enemy Simulation
    enemySpawnTimer.current += delta;
    if (enemySpawnTimer.current > 15) { // Spawn enemy every 15 seconds
      enemySpawnTimer.current = 0;
      const spawnPos = getRandomSurfacePos();
      setEnemies(prev => [...prev, {
        id: `enemy-${Date.now()}`,
        position: spawnPos,
        health: 100,
        targetPos: BASE_POSITION.clone()
      }]);
    }

    setEnemies(currentEnemies => {
      return currentEnemies.map(e => {
        const nextPos = moveOnSphere(e.position, e.targetPos, AGENT_SPEED * delta * 6);
        return { ...e, position: nextPos };
      }).filter(e => e.health > 0 && e.position.distanceTo(BASE_POSITION) > 1);
    });

    // 4. Projectile Simulation
    setProjectiles(prev => {
      const next: Projectile[] = [];
      prev.forEach(p => {
        const enemy = enemies.find(e => e.id === p.targetId);
        if (enemy) {
          const nextPos = p.position.clone().add(p.velocity);
          if (nextPos.distanceTo(enemy.position) < 1.0) {
            setEnemies(es => es.map(e => e.id === p.targetId ? { ...e, health: e.health - 50 } : e));
          } else {
            next.push({ ...p, position: nextPos });
          }
        }
      });
      return next;
    });

    // 5. Cleanup and Growth
    const completedHuts = buildings.filter(b => b.isComplete && b.type === 'HUT').length;
    const maxPop = 5 + (completedHuts * 3);
    if (followers.length < maxPop && completedHuts > 0) {
      growthTimer.current += delta * GROWTH_RATE * completedHuts;
      if (growthTimer.current >= 1) {
        growthTimer.current = 0;
        const parentHut = buildings.find(b => b.isComplete && b.type === 'HUT');
        if (parentHut) {
          setFollowers(prev => [...prev, {
            id: `follower-${Date.now()}`,
            position: parentHut.position.clone(),
            state: AgentState.WANDER,
            role: FollowerRole.WORKER,
            targetId: null,
            targetPos: getRandomSurfacePos(),
            woodCarrying: 0
          }]);
        }
      }
    }
    setTrees(prev => prev.filter(t => t.health > 0));
  });

  useMemo(() => {
    const completedHuts = buildings.filter(b => b.isComplete && b.type === 'HUT').length;
    setMaxPopulation(5 + completedHuts * 3);
    setPopulation(followers.length);
  }, [buildings, followers.length]);

  const visibleWoodPiles = Math.min(woodPilePositions.length, Math.floor(wood / 25));

  return (
    <group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 10]} intensity={1.8} castShadow />
      
      <Sphere args={[PLANET_RADIUS, 64, 64]} onPointerMove={handlePointerMove} onClick={handlePlanetClick}>
        <meshStandardMaterial color="#2d4a22" roughness={0.9} flatShading />
      </Sphere>

      <SurfaceAligned position={BASE_POSITION}>
        <group>
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <Cylinder args={[0.12, 0.12, 8, 8]} position={[0, 4, 0]}>
              <meshStandardMaterial color="#333" />
            </Cylinder>
            <Box args={[3.5, 2.2, 0.1]} position={[1.75, 7, 0]}>
              <meshStandardMaterial color="#7b2cbf" emissive="#3c096c" emissiveIntensity={0.6} />
            </Box>
            <Torus args={[0.5, 0.1, 16, 100]} position={[0, 8.5, 0]} rotation={[Math.PI/2, 0, 0]}>
               <meshStandardMaterial color="#ffea00" emissive="#ffea00" />
            </Torus>
          </Float>
          <Ring args={[3.2, 3.5, 48]} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
             <meshBasicMaterial color="#ffea00" transparent opacity={0.2} />
          </Ring>
        </group>
      </SurfaceAligned>

      {woodPilePositions.slice(0, visibleWoodPiles).map((pos, i) => (
        <FirewoodPile key={`wood-pile-${i}`} position={pos} seed={i} />
      ))}

      {trees.map(tree => (
        <SurfaceAligned key={tree.id} position={tree.position}>
          <group onClick={handleEntityClick(tree.id, 'TREE')}>
            <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
              <Cone args={[0.6, 2.2, 8]} position={[0, 1.6, 0]}>
                <meshStandardMaterial color="#1b4332" />
              </Cone>
              <Cylinder args={[0.2, 0.25, 1, 8]} position={[0, 0.5, 0]}>
                <meshStandardMaterial color="#3d2b1f" />
              </Cylinder>
            </Float>
            {tree.health < 100 && (
              <Html distanceFactor={10} position={[0, 3.5, 0]}>
                <div className="w-16 h-1.5 bg-black/50 border border-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_8px_#10b981]" style={{ width: `${(tree.health / tree.maxHealth) * 100}%` }} />
                </div>
              </Html>
            )}
          </group>
        </SurfaceAligned>
      ))}

      {buildings.map(building => (
        <SurfaceAligned key={building.id} position={building.position}>
          <group onClick={handleEntityClick(building.id, 'BUILDING')} scale={building.isComplete ? 1 : 0.6 + (building.progress / 250)}>
            {building.type === 'HUT' && (
              <>
                <Box args={[3, 2, 3]} position={[0, 1, 0]}>
                  <meshStandardMaterial color={building.isComplete ? "#bc6c25" : "#4a4e69"} />
                </Box>
                <Cone args={[2.5, 2, 4]} position={[0, 3, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <meshStandardMaterial color="#606c38" />
                </Cone>
              </>
            )}

            {building.type === 'WARRIOR_HUT' && (
              <>
                <Box args={[4, 1.5, 4]} position={[0, 0.75, 0]}>
                  <meshStandardMaterial color={building.isComplete ? "#641212" : "#333"} />
                </Box>
                <Cylinder args={[2, 2.2, 3, 4]} position={[0, 3, 0]} rotation={[0, Math.PI / 4, 0]}>
                   <meshStandardMaterial color="#4a4a4a" />
                </Cylinder>
                <Cone args={[0.5, 2, 4]} position={[1.5, 4.5, 1.5]} rotation={[0, Math.PI/4, 0]}>
                   <meshStandardMaterial color="#941b1b" />
                </Cone>
                <Cone args={[0.5, 2, 4]} position={[-1.5, 4.5, -1.5]} rotation={[0, Math.PI/4, 0]}>
                   <meshStandardMaterial color="#941b1b" />
                </Cone>
              </>
            )}

            {building.type === 'TOWER' && (
              <>
                <Cylinder args={[1.5, 1.8, 6, 8]} position={[0, 3, 0]}>
                  <meshStandardMaterial color={building.isComplete ? "#555" : "#333"} />
                </Cylinder>
                <Box args={[2.5, 1, 2.5]} position={[0, 6.5, 0]}>
                  <meshStandardMaterial color="#777" />
                </Box>
              </>
            )}

            {building.type === 'TEMPLE' && (
              <>
                <Box args={[6, 1, 6]} position={[0, 0.5, 0]}>
                   <meshStandardMaterial color="#222" />
                </Box>
                <Box args={[4, 2, 4]} position={[0, 2, 0]}>
                   <meshStandardMaterial color="#c0c0c0" />
                </Box>
                <Box args={[2, 4, 2]} position={[0, 5, 0]}>
                   <meshStandardMaterial color="#ffd700" />
                </Box>
                {building.isComplete && (
                   <pointLight position={[0, 8, 0]} color="#00ffff" intensity={2} distance={10} />
                )}
              </>
            )}

            {!building.isComplete && (
              <Html distanceFactor={12} position={[0, 6, 0]}>
                <div className="flex flex-col items-center gap-1">
                  <div className="bg-black/90 px-3 py-1 rounded-full border border-orange-500/30 whitespace-nowrap shadow-xl">
                    <span className="text-orange-500 font-black text-[10px] tracking-tighter">CONSTRUCTING {Math.floor(building.progress)}%</span>
                  </div>
                  <div className="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-orange-500 shadow-[0_0_10px_orange]" style={{ width: `${building.progress}%` }} />
                  </div>
                </div>
              </Html>
            )}
            
            {building.type === 'TOWER' && building.isComplete && (
              <Html distanceFactor={8} position={[0, 8, 0]}>
                <div className="text-[8px] bg-black/50 px-2 py-0.5 rounded text-white/50 border border-white/10 uppercase font-bold">
                  GARRISON {building.assignedWorkers.length} / {TOWER_CAPACITY}
                </div>
              </Html>
            )}
          </group>
        </SurfaceAligned>
      ))}

      {followers.map(follower => {
        const isInteracting = (follower.state === AgentState.GATHER || follower.state === AgentState.BUILD || follower.state === AgentState.TRAIN);
        const targetEntity = isInteracting ? 
            (follower.state === AgentState.GATHER ? trees.find(t => t.id === follower.targetId) : buildings.find(b => b.id === follower.targetId)) 
            : null;
        const isCloseEnough = targetEntity && follower.position.distanceTo(targetEntity.position) <= INTERACTION_RANGE + 1.0;
        
        // If guarding, calculate the visual height offset for the tower platform
        const tower = follower.state === AgentState.GUARD ? buildings.find(b => b.id === follower.targetId) : null;
        const isAtTower = tower && follower.position.distanceTo(tower.position) < 0.2;
        const visualHeight = isAtTower ? 7.2 : 0;
        const towerGuardOffset = isAtTower ? (tower.assignedWorkers.indexOf(follower.id) === 0 ? 0.6 : -0.6) : 0;

        return (
          <group key={follower.id} position={new THREE.Vector3(0, visualHeight, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), follower.position.clone().normalize()))}>
             <SurfaceAligned position={follower.position}>
               <group position={[towerGuardOffset, 0, 0]}>
                  <FollowerMesh 
                    follower={follower} 
                    isSelected={selectedFollowerId === follower.id} 
                    isAnimating={isInteracting && isCloseEnough}
                    onClick={handleFollowerClick(follower.id)}
                  />
               </group>
            </SurfaceAligned>
          </group>
        );
      })}

      {/* Enemies */}
      {enemies.map(enemy => (
        <SurfaceAligned key={enemy.id} position={enemy.position}>
          <group scale={0.8}>
            <Box args={[0.7, 1, 0.5]} position={[0, 0.5, 0]}>
              <meshStandardMaterial color="#800" />
            </Box>
            <Sphere args={[0.3]} position={[0, 1.2, 0]}>
               <meshStandardMaterial color="#222" />
            </Sphere>
            <Html distanceFactor={10} position={[0, 2, 0]}>
               <div className="w-10 h-1 bg-black/60 rounded-full overflow-hidden">
                 <div className="h-full bg-red-500" style={{ width: `${enemy.health}%` }} />
               </div>
            </Html>
          </group>
        </SurfaceAligned>
      ))}

      {/* Projectiles (Arrows) */}
      {projectiles.map(proj => (
        <group key={proj.id} position={proj.position}>
           <Box args={[0.1, 0.1, 0.6]}>
              <meshBasicMaterial color="#ffea00" />
           </Box>
        </group>
      ))}

      {isPlacementMode && ghostPos && (
        <SurfaceAligned position={ghostPos}>
          <Box args={[4, 0.2, 4]} position={[0, 0.1, 0]}>
            <meshStandardMaterial color="#00ff00" transparent opacity={0.4} />
          </Box>
          <Box args={[3.5, 3.5, 3.5]} position={[0, 1.75, 0]}>
            <meshStandardMaterial color="#00ff00" transparent opacity={0.1} wireframe />
          </Box>
        </SurfaceAligned>
      )}

      <Sphere args={[120, 32, 32]} inverted>
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </Sphere>
    </group>
  );
};

interface FollowerMeshProps {
  follower: Follower;
  isSelected: boolean;
  isAnimating: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

const FollowerMesh: React.FC<FollowerMeshProps> = ({ follower, isSelected, isAnimating, onClick }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      if (isAnimating) {
        const speed = 12;
        const pitch = Math.abs(Math.sin(state.clock.elapsedTime * speed)) * 0.7;
        groupRef.current.rotation.x = pitch;
      } else {
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.15);
      }
    }
  });

  const getRoleColor = () => {
    if (follower.role === FollowerRole.SHAMAN) return "#7b2cbf";
    if (follower.role === FollowerRole.WARRIOR) return "#c1121f";
    
    switch (follower.state) {
      case AgentState.GATHER: return "#2d6a4f";
      case AgentState.BUILD: return "#d4a373";
      case AgentState.DELIVER: return "#ff9f1c";
      default: return "#457b9d";
    }
  };

  return (
    <group onClick={onClick}>
      <group ref={groupRef}>
        <Float speed={5} rotationIntensity={0.4} floatIntensity={0.25}>
          <Box args={[0.7, follower.role === FollowerRole.SHAMAN ? 1.4 : 1, 0.5]} position={[0, follower.role === FollowerRole.SHAMAN ? 0.7 : 0.5, 0]}>
            <meshStandardMaterial color={getRoleColor()} />
          </Box>
          
          <Sphere args={[follower.role === FollowerRole.SHAMAN ? 0.4 : 0.35]} position={[0, follower.role === FollowerRole.SHAMAN ? 1.6 : 1.2, 0]}>
            <meshStandardMaterial color={follower.role === FollowerRole.WARRIOR ? "#333" : "#fefae0"} />
          </Sphere>
          
          {follower.role === FollowerRole.WARRIOR && (
            <group position={[0, 1.2, 0]}>
               <Cone args={[0.1, 0.4, 4]} position={[0.25, 0.3, 0]} rotation={[0.4, 0, -0.4]}>
                 <meshStandardMaterial color="#fff" />
               </Cone>
               <Cone args={[0.1, 0.4, 4]} position={[-0.25, 0.3, 0]} rotation={[0.4, 0, 0.4]}>
                 <meshStandardMaterial color="#fff" />
               </Cone>
            </group>
          )}

          {follower.role === FollowerRole.SHAMAN && (
             <pointLight intensity={0.5} distance={3} color="#bc4ed8" />
          )}
          
          {follower.woodCarrying > 0 && (
             <Box args={[0.9, 0.3, 0.4]} position={[0, 0.15, 0.3]}>
                <meshStandardMaterial color="#4a3728" />
             </Box>
          )}
        </Float>
      </group>
      
      {isSelected && (
        <group position={[0, 0.1, 0]}>
          <Torus args={[1.2, 0.05, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color="#00f2ff" transparent opacity={0.6} />
          </Torus>
          <pointLight intensity={1} distance={2} color="#00f2ff" />
        </group>
      )}

      <Html distanceFactor={10} position={[0, 2.5, 0]}>
          <div className="flex flex-col items-center">
            <span className={`text-[9px] font-black bg-black/80 px-2 py-0.5 rounded-full uppercase border ${isSelected ? 'text-cyan-400 border-cyan-400/50 scale-110 shadow-[0_0_10px_#00f2ff55]' : 'text-white/80 border-white/10'}`}>
              {follower.role}
            </span>
            <span className="text-[7px] text-white/40 mt-1 uppercase tracking-tighter">{follower.state}</span>
          </div>
      </Html>
    </group>
  );
};

export default World;
