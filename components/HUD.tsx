
import React, { useState } from 'react';
import { BUILDING_STATS } from '../constants';
import { BuildingType } from '../types';

interface HUDProps {
  gameState: {
    wood: number;
    population: number;
    maxPopulation: number;
  };
  isPlacementMode: boolean;
  placementType: BuildingType | null;
  onEnterPlacement: (type: BuildingType) => void;
  onCancelPlacement: () => void;
}

const HUD: React.FC<HUDProps> = ({ gameState, isPlacementMode, placementType, onEnterPlacement, onCancelPlacement }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-6">
      {/* Top Bar: Stats */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 flex gap-8">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-white/50 font-bold">Wood Reserves</span>
            <span className="text-2xl font-mono text-amber-400">{Math.floor(gameState.wood)}</span>
          </div>
          <div className="w-px h-full bg-white/10" />
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-white/50 font-bold">Followers</span>
            <span className="text-2xl font-mono text-cyan-400">
              {gameState.population} <span className="text-sm text-white/30">/ {gameState.maxPopulation}</span>
            </span>
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 text-right">
          <h1 className="text-xl font-black italic tracking-tighter text-white/80 uppercase">Orb Shaman</h1>
          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Build Menu Prototype</p>
        </div>
      </div>

      {/* Bottom Bar: Build Menu */}
      <div className="flex flex-col items-center gap-4 pointer-events-auto mb-4">
        {!isPlacementMode ? (
          <div className="flex flex-col items-center">
            {isMenuOpen && (
              <div className="flex gap-4 mb-6 animate-in slide-in-from-bottom-4 duration-300">
                {(Object.entries(BUILDING_STATS) as [BuildingType, typeof BUILDING_STATS['HUT']][]).map(([type, stats]) => (
                  <button
                    key={type}
                    onClick={() => {
                      onEnterPlacement(type);
                      setIsMenuOpen(false);
                    }}
                    disabled={gameState.wood < stats.cost}
                    className={`
                      w-40 p-4 rounded-xl border flex flex-col items-center text-center transition-all transform hover:scale-105 active:scale-95 group
                      ${gameState.wood >= stats.cost 
                        ? 'bg-black/80 border-white/20 hover:border-amber-500/50 text-white' 
                        : 'bg-black/40 border-white/5 text-white/20 cursor-not-allowed'}
                    `}
                  >
                    <span className="text-sm font-bold uppercase tracking-tight">{stats.label}</span>
                    <span className={`text-xs mt-1 ${gameState.wood >= stats.cost ? 'text-amber-400' : 'text-white/10'}`}>
                      {stats.cost} Wood
                    </span>
                    <span className="text-[9px] mt-2 opacity-0 group-hover:opacity-100 transition-opacity leading-tight text-white/60">
                      {stats.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            <button 
              onClick={toggleMenu}
              className={`
                px-12 py-5 rounded-full font-black text-xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl
                ${isMenuOpen ? 'bg-white text-black' : 'bg-gradient-to-tr from-amber-600 to-orange-500 text-white'}
              `}
            >
              {isMenuOpen ? 'CLOSE MENU' : 'BUILD STRUCTURES'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
             <div className="flex items-center gap-3 bg-black/90 px-6 py-3 rounded-2xl border border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)] animate-pulse">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <p className="text-white font-bold uppercase text-sm tracking-widest">
                  Placing: {placementType ? BUILDING_STATS[placementType].label : ''}
                </p>
            </div>
            <button 
              onClick={onCancelPlacement}
              className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-200 px-8 py-2 rounded-full font-bold transition-colors uppercase text-xs"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Controls Help */}
      <div className="fixed bottom-6 left-6 text-[10px] text-white/30 pointer-events-none uppercase space-y-1">
        <p>Left Click: Target Entity / Select Location</p>
        <p>Right Click: Move Camera (Rotation)</p>
        <p>Scroll: Zoom In/Out</p>
      </div>
    </div>
  );
};

export default HUD;
