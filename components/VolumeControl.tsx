
import React from 'react';
import { Volume2Icon } from '../assets/icons';

interface VolumeControlProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({ volume, onVolumeChange }) => {
  return (
    <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
      <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
        <Volume2Icon className="w-5 h-5 mr-2 text-sky-400"/> Master Volume
      </h3>
      <div className="flex items-center space-x-3">
        <input
          type="range"
          min="0"
          max="1.5" // Max 150% volume to allow some boost, but not too much
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
        <span className="text-sm text-sky-300 tabular-nums w-16 text-right">{(volume * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};
    