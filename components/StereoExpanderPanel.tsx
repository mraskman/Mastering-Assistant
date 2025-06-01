
import React from 'react';
import { StereoExpanderParams } from '../types';
import { ArrowsRightLeftIcon } from '../assets/icons'; // Assuming this icon will be created

interface StereoExpanderPanelProps {
  stereoExpanderParams: StereoExpanderParams;
  onStereoExpanderChange: (params: StereoExpanderParams) => void;
}

export const StereoExpanderPanel: React.FC<StereoExpanderPanelProps> = ({ stereoExpanderParams, onStereoExpanderChange }) => {
  const handleWidthChange = (value: number) => {
    onStereoExpanderChange({ ...stereoExpanderParams, width: value });
  };

  return (
    <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
      <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
        <ArrowsRightLeftIcon className="w-5 h-5 mr-2 text-sky-400" /> Stereo Expander
      </h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="stereo-width" className="block text-xs text-slate-400 mb-1">Width</label>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              id="stereo-width"
              min="0"   // Mono
              max="2"   // Double width
              step="0.01"
              value={stereoExpanderParams.width}
              onChange={(e) => handleWidthChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
              aria-label="Stereo width amount"
            />
            <span className="text-xs text-sky-300 tabular-nums w-12 text-right">
              {(stereoExpanderParams.width * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Adjusts the stereo width. 0% is mono, 100% is normal stereo, above 100% enhances width.</p>
        </div>
      </div>
    </div>
  );
};