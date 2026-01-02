
import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import HUD from './components/HUD';
import World from './components/World';
import { BUILDING_STATS } from './constants';
import { BuildingType } from './types';

const App: React.FC = () => {
  const [wood, setWood] = useState(800); // Start with some wood to explore the new menu
  const [population, setPopulation] = useState(5);
  const [maxPopulation, setMaxPopulation] = useState(5);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placementType, setPlacementType] = useState<BuildingType | null>(null);

  const handleEnterPlacement = (type: BuildingType) => {
    if (wood >= BUILDING_STATS[type].cost) {
      setPlacementType(type);
      setIsPlacementMode(true);
    }
  };

  const handleCancelPlacement = () => {
    setIsPlacementMode(false);
    setPlacementType(null);
  };

  const handlePlacedBuilding = () => {
    if (placementType) {
      setWood(prev => prev - BUILDING_STATS[placementType].cost);
      setIsPlacementMode(false);
      setPlacementType(null);
    }
  };

  return (
    <div className="w-full h-screen bg-neutral-950 relative">
      {/* 3D Scene */}
      <Canvas shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[50, 40, 50]} fov={40} />
          <OrbitControls 
            enablePan={false} 
            minDistance={25} 
            maxDistance={90} 
            rotateSpeed={0.5}
            dampingFactor={0.05}
          />
          
          <Stars radius={150} depth={50} count={6000} factor={6} saturation={0.5} fade speed={1.5} />
          
          <World 
            wood={wood} 
            setWood={setWood} 
            setPopulation={setPopulation}
            setMaxPopulation={setMaxPopulation}
            isPlacementMode={isPlacementMode}
            placementType={placementType}
            onPlacedBuilding={handlePlacedBuilding}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <HUD 
        gameState={{ wood, population, maxPopulation }} 
        isPlacementMode={isPlacementMode}
        placementType={placementType}
        onEnterPlacement={handleEnterPlacement}
        onCancelPlacement={handleCancelPlacement}
      />

      {/* Loading Overlay */}
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-white font-bold tracking-widest uppercase animate-pulse">Forging Spherical Realms...</p>
          </div>
        </div>
      }>
        <div className="hidden" />
      </Suspense>

      {/* Screen Effects Overlay */}
      <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]" />
    </div>
  );
};

export default App;
