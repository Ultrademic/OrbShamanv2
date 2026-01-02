
import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import HUD from './components/HUD';
import World from './components/World';
import { HUT_COST } from './constants';

const App: React.FC = () => {
  const [wood, setWood] = useState(500); // Start with some wood
  const [population, setPopulation] = useState(5);
  const [maxPopulation, setMaxPopulation] = useState(5);
  const [isPlacementMode, setIsPlacementMode] = useState(false);

  const handleEnterPlacement = () => {
    if (wood >= HUT_COST) {
      setIsPlacementMode(true);
    }
  };

  const handleCancelPlacement = () => {
    setIsPlacementMode(false);
  };

  const handlePlacedBuilding = () => {
    setWood(prev => prev - HUT_COST);
    setIsPlacementMode(false);
  };

  return (
    <div className="w-full h-screen bg-neutral-950 relative">
      {/* 3D Scene */}
      <Canvas shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[50, 40, 50]} fov={40} />
          <OrbitControls 
            enablePan={false} 
            minDistance={30} 
            maxDistance={80} 
            rotateSpeed={0.5}
            dampingFactor={0.05}
          />
          
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <World 
            wood={wood} 
            setWood={setWood} 
            setPopulation={setPopulation}
            setMaxPopulation={setMaxPopulation}
            isPlacementMode={isPlacementMode}
            onPlacedBuilding={handlePlacedBuilding}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <HUD 
        gameState={{ wood, population, maxPopulation }} 
        isPlacementMode={isPlacementMode}
        onEnterPlacement={handleEnterPlacement}
        onCancelPlacement={handleCancelPlacement}
      />

      {/* Loading Overlay */}
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-white font-bold tracking-widest uppercase">Initializing Planet...</p>
          </div>
        </div>
      }>
        <div className="hidden" />
      </Suspense>

      {/* Screen Effects Overlay (Optional: Vignette via Tailwind) */}
      <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
    </div>
  );
};

export default App;
