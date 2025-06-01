
import React from 'react';
import { CompressorParams, LimiterParams } from '../types';
import { ZapIcon, ShieldCheckIcon } from '../assets/icons';
import { GainReductionMeter } from './GainReductionMeter'; 

interface DynamicsPanelProps {
  compressorParams: CompressorParams;
  limiterParams: LimiterParams;
  onCompressorChange: (params: CompressorParams) => void;
  onLimiterChange: (params: LimiterParams) => void;
  gainReductionDb: number; 
  limiterGainReductionDb: number; // New prop for limiter's gain reduction
}

export const DynamicsPanel: React.FC<DynamicsPanelProps> = ({
  compressorParams,
  limiterParams,
  onCompressorChange,
  onLimiterChange,
  gainReductionDb,
  limiterGainReductionDb 
}) => {
  const handleCompressorParamChange = (param: keyof CompressorParams, value: number) => {
    onCompressorChange({ ...compressorParams, [param]: value });
  };

  const handleLimiterParamChange = (param: keyof LimiterParams, value: number) => {
    onLimiterChange({ ...limiterParams, [param]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Compressor Controls */}
      <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
        <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
            <ZapIcon className="w-5 h-5 mr-2 text-sky-400"/> Compressor
        </h3>
        <GainReductionMeter reductionDb={gainReductionDb} /> 
        <div className="space-y-3 mt-4">
          {[
            { label: 'Threshold (dB)', param: 'threshold', min: -60, max: 0, step: 0.1, value: compressorParams.threshold },
            { label: 'Knee (dB)', param: 'knee', min: 0, max: 40, step: 0.1, value: compressorParams.knee },
            { label: 'Ratio', param: 'ratio', min: 1, max: 20, step: 0.1, value: compressorParams.ratio },
            { label: 'Attack (s)', param: 'attack', min: 0.001, max: 0.2, step: 0.001, value: compressorParams.attack },
            { label: 'Release (s)', param: 'release', min: 0.05, max: 1, step: 0.005, value: compressorParams.release },
          ].map(({ label, param, min, max, step, value }) => (
            <div key={param}>
              <label htmlFor={`comp-${param}`} className="block text-xs text-slate-400 mb-1">{label}</label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  id={`comp-${param}`}
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => handleCompressorParamChange(param as keyof CompressorParams, parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <span className="text-xs text-sky-300 tabular-nums w-12 text-right">
                  {param === 'attack' || param === 'release' ? value.toFixed(3) : value.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Limiter Controls */}
      <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
        <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
            <ShieldCheckIcon className="w-5 h-5 mr-2 text-sky-400"/> Limiter
        </h3>
        <GainReductionMeter reductionDb={limiterGainReductionDb} />
        <div className="space-y-3 mt-4">
            <div>
              <label htmlFor="limiter-threshold" className="block text-xs text-slate-400 mb-1">Ceiling (dBFS)</label>
               <div className="flex items-center space-x-2">
                <input
                    type="range"
                    id="limiter-threshold"
                    min={-12}
                    max={0}
                    step={0.1}
                    value={limiterParams.threshold}
                    onChange={(e) => handleLimiterParamChange('threshold', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    aria-label="Limiter ceiling"
                />
                <span className="text-xs text-sky-300 tabular-nums w-12 text-right">{limiterParams.threshold.toFixed(1)}</span>
              </div>
            </div>
            <div>
              <label htmlFor="limiter-release" className="block text-xs text-slate-400 mb-1">Release (ms)</label>
               <div className="flex items-center space-x-2">
                <input
                    type="range"
                    id="limiter-release"
                    min={0.01} // 10ms
                    max={0.5}  // 500ms
                    step={0.001} // 1ms steps
                    value={limiterParams.release}
                    onChange={(e) => handleLimiterParamChange('release', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    aria-label="Limiter release time"
                />
                <span className="text-xs text-sky-300 tabular-nums w-12 text-right">{(limiterParams.release * 1000).toFixed(0)}</span>
              </div>
            </div>
             <p className="text-xs text-slate-500 mt-2">Acts as a brickwall limiter. Sets the maximum output level and how quickly it recovers.</p>
        </div>
      </div>
    </div>
  );
};