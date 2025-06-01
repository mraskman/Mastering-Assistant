import React from 'react';
import { ReverbParams } from '../types';
import { SpeakerWaveIcon } from '../assets/icons';

interface ReverbPanelProps {
  reverbParams: ReverbParams;
  onReverbChange: (params: ReverbParams) => void;
}

export const ReverbPanel: React.FC<ReverbPanelProps> = ({ reverbParams, onReverbChange }) => {
  const handleParamChange = (param: keyof ReverbParams, value: number) => {
    onReverbChange({ ...reverbParams, [param]: value });
  };

  return (
    <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
      <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
        <SpeakerWaveIcon className="w-5 h-5 mr-2 text-sky-400" /> Reverb
      </h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="reverb-mix" className="block text-xs text-slate-400 mb-1">Mix</label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              id="reverb-mix"
              min="0"
              max="1"
              step="0.01"
              value={reverbParams.mix}
              onChange={(e) => handleParamChange('mix', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
              aria-label="Reverb mix amount"
            />
            <span className="text-xs text-sky-300 tabular-nums w-12 text-right">
              {(reverbParams.mix * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        
        <div>
          <label htmlFor="reverb-decay" className="block text-xs text-slate-400 mb-1">Decay (s)</label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              id="reverb-decay"
              min="0.1"
              max="5" 
              step="0.05"
              value={reverbParams.decay}
              onChange={(e) => handleParamChange('decay', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
              aria-label="Reverb decay time"
            />
            <span className="text-xs text-sky-300 tabular-nums w-12 text-right">
              {reverbParams.decay.toFixed(1)}s
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="reverb-predelay" className="block text-xs text-slate-400 mb-1">Pre-delay (ms)</label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              id="reverb-predelay"
              min="0" // 0s
              max="0.5" // 500ms
              step="0.001" // 1ms steps
              value={reverbParams.preDelay}
              onChange={(e) => handleParamChange('preDelay', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
              aria-label="Reverb pre-delay time"
            />
            <span className="text-xs text-sky-300 tabular-nums w-12 text-right">
              {(reverbParams.preDelay * 1000).toFixed(0)}ms
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="reverb-damping" className="block text-xs text-slate-400 mb-1">Damping (Hz)</label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              id="reverb-damping"
              min="500" // 500 Hz
              max="20000" // 20 kHz
              step="100"
              value={reverbParams.damping}
              onChange={(e) => handleParamChange('damping', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
              aria-label="Reverb damping frequency"
            />
            <span className="text-xs text-sky-300 tabular-nums w-12 text-right">
              {reverbParams.damping.toFixed(0)}Hz
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Mix: Wet/Dry. Decay: Length. Pre-delay: Initial delay before reverb. Damping: High-frequency absorption.
        </p>
      </div>
    </div>
  );
};