import React from 'react';
import { HUT_COST } from '../constants';
// Fix: Import GameState from types instead of constants
import { GameState } from '../types';

interface HUDProps {
  gameState: {
    wood: number;
    population: number;
    maxPopulation: number;
  };
  isPlacementMode: boolean;
  onEnterPlacement: () => void;
  onCancelPlacement: () => void;
}

const HUD: React.FC<HUDProps> = ({ gameState, isPlacementMode, onEnterPlacement, onCancelPlacement }) => {
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
          <h1 className="text-xl font-black italic tracking-tighter text-white/80">SPHERE PROTOTYPE</h1>
          <p className="text-[10px] text-white/40 uppercase font-bold">v0.1.0 Alpha Engine</p>
        </div>
      </div>

      {/* Bottom Bar: Actions */}
      <div className="flex justify-center items-end gap-4 pointer-events-auto">
        {!isPlacementMode ? (
          <button 
            onClick={onEnterPlacement}
            disabled={gameState.wood < 200}
            className={`
              px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 active:scale-95
              ${gameState.wood >= 200 
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-900/40' 
                : 'bg-white/10 text-white/20 cursor-not-allowed border border-white/5'}
            `}
          >
            BUILD HUT ({HUT_COST} Wood)
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-white text-sm bg-black/80 px-4 py-2 rounded-full border border-orange-500/50 animate-pulse">
              Click on the planet to place your Hut
            </p>
            <button 
              onClick={onCancelPlacement}
              className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-200 px-6 py-2 rounded-full font-bold transition-colors"
            >
              Cancel Placement
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