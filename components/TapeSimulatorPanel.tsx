import React from 'react';
import { TapeSimulatorParams } from '../types';
import { DiscIcon } from '../assets/icons'; // Assuming DiscIcon for tape/saturation

interface TapeSimulatorPanelProps {
  params: TapeSimulatorParams;
  onParamsChange: (params: TapeSimulatorParams) => void;
}

export const TapeSimulatorPanel: React.FC<TapeSimulatorPanelProps> = ({ params, onParamsChange }) => {
  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onParamsChange({ ...params, enabled: e.target.checked });
  };

  const handleDriveChange = (value: number) => {
    onParamsChange({ ...params, drive: value });
  };

  return (
    <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center">
          <DiscIcon className="w-5 h-5 mr-2 text-sky-400" /> Tape Simulator
        </h3>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={params.enabled}
            onChange={handleEnabledChange}
            className="form-checkbox h-5 w-5 text-sky-500 bg-slate-500 border-slate-400 rounded focus:ring-sky-600"
            aria-label="Enable Tape Simulator"
          />
          <span className="text-sm text-slate-300">Enabled</span>
        </label>
      </div>

      {params.enabled && (
        <div className="space-y-3">
          <div>
            <label htmlFor="tape-drive" className="block text-xs text-slate-400 mb-1">Drive</label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                id="tape-drive"
                min="0"   // 0%
                max="1"   // 100%
                step="0.01"
                value={params.drive}
                onChange={(e) => handleDriveChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
                aria-label="Tape drive amount"
              />
              <span className="text-xs text-sky-300 tabular-nums w-12 text-right">
                {(params.drive * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Increases harmonic saturation for warmth and character. Subtle values often work best.</p>
          </div>
        </div>
      )}
      {!params.enabled && (
        <p className="text-sm text-slate-400 text-center py-4">Tape simulator is disabled.</p>
      )}
    </div>
  );
};