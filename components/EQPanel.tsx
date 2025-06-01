
import React from 'react';
import { EQBand } from '../types';
import { SlidersIcon } from '../assets/icons';

interface EQPanelProps {
  bands: EQBand[];
  onBandChange: (bandId: string, gain: number) => void;
}

const EQBandControl: React.FC<{ band: EQBand; onChange: (gain: number) => void }> = ({ band, onChange }) => {
  return (
    <div className="flex flex-col items-center space-y-1 p-2 bg-slate-700 rounded-md">
      <label htmlFor={`eq-${band.id}`} className="text-xs text-slate-400 whitespace-nowrap">{band.label}</label>
      <input
        type="range"
        id={`eq-${band.id}`}
        min="-15"
        max="15"
        step="0.1"
        value={band.gain}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
        style={{ 
          writingMode: 'vertical-lr',
          WebkitAppearance: 'slider-vertical', 
          width: '20px', 
          height: '100px' 
        }}
      />
      <span className="text-xs text-sky-300 tabular-nums">{band.gain.toFixed(1)} dB</span>
    </div>
  );
};


export const EQPanel: React.FC<EQPanelProps> = ({ bands, onBandChange }) => {
  return (
    <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
      <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
        <SlidersIcon className="w-5 h-5 mr-2 text-sky-400"/> Equalizer
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {bands.map((band) => (
          <EQBandControl
            key={band.id}
            band={band}
            onChange={(gain) => onBandChange(band.id, gain)}
          />
        ))}
      </div>
    </div>
  );
};
