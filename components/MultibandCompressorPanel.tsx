
import React from 'react';
import { MultibandCompressorParams, MultibandCompressorBandParams } from '../types';
import { GainReductionMeter } from './GainReductionMeter';
import { LayersIcon } from '../assets/icons'; // Assuming LayersIcon is added

interface MultibandCompressorPanelProps {
  params: MultibandCompressorParams;
  onParamsChange: (params: MultibandCompressorParams) => void;
  gainReduction: { low: number; mid: number; high: number };
}

type BandKey = 'lowBand' | 'midBand' | 'highBand';

const BandControls: React.FC<{
  bandName: string;
  bandParams: MultibandCompressorBandParams;
  onBandParamChange: (param: keyof MultibandCompressorBandParams, value: number) => void;
  gainReductionDb: number;
  crossoverInfo?: string;
}> = ({ bandName, bandParams, onBandParamChange, gainReductionDb, crossoverInfo }) => {
  return (
    <div className="bg-slate-700 p-3 rounded-md shadow">
      <h4 className="text-md font-semibold text-sky-300 mb-1">{bandName} Band</h4>
      {crossoverInfo && <p className="text-xs text-slate-400 mb-2">{crossoverInfo}</p>}
      <GainReductionMeter reductionDb={gainReductionDb} />
      <div className="space-y-2 mt-2">
        {[
          { label: 'Threshold (dB)', param: 'threshold', min: -60, max: 0, step: 0.1, value: bandParams.threshold },
          { label: 'Knee (dB)', param: 'knee', min: 0, max: 40, step: 0.1, value: bandParams.knee },
          { label: 'Ratio', param: 'ratio', min: 1, max: 20, step: 0.1, value: bandParams.ratio },
          { label: 'Attack (s)', param: 'attack', min: 0.001, max: 0.2, step: 0.001, value: bandParams.attack },
          { label: 'Release (s)', param: 'release', min: 0.01, max: 1, step: 0.005, value: bandParams.release },
          { label: 'Makeup (dB)', param: 'makeupGain', min: -12, max: 12, step: 0.1, value: bandParams.makeupGain },
        ].map(({ label, param, min, max, step, value }) => (
          <div key={param}>
            <label htmlFor={`mb-${bandName}-${param}`} className="block text-xs text-slate-400 mb-0.5">{label}</label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                id={`mb-${bandName}-${param}`}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onBandParamChange(param as keyof MultibandCompressorBandParams, parseFloat(e.target.value))}
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
  );
};

export const MultibandCompressorPanel: React.FC<MultibandCompressorPanelProps> = ({
  params,
  onParamsChange,
  gainReduction,
}) => {
  const handleBandParamChange = (bandKey: BandKey, param: keyof MultibandCompressorBandParams, value: number) => {
    onParamsChange({
      ...params,
      [bandKey]: {
        ...params[bandKey],
        [param]: value,
      },
    });
  };

  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onParamsChange({ ...params, enabled: e.target.checked });
  };

  return (
    <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center">
          <LayersIcon className="w-5 h-5 mr-2 text-sky-400" /> Multiband Compressor
        </h3>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={params.enabled}
            onChange={handleEnabledChange}
            className="form-checkbox h-5 w-5 text-sky-500 bg-slate-500 border-slate-400 rounded focus:ring-sky-600"
          />
          <span className="text-sm text-slate-300">Enabled</span>
        </label>
      </div>

      {params.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BandControls
            bandName="Low"
            bandParams={params.lowBand}
            onBandParamChange={(p, v) => handleBandParamChange('lowBand', p, v)}
            gainReductionDb={gainReduction.low}
            crossoverInfo={`< ${params.crossoverLowMid} Hz`}
          />
          <BandControls
            bandName="Mid"
            bandParams={params.midBand}
            onBandParamChange={(p, v) => handleBandParamChange('midBand', p, v)}
            gainReductionDb={gainReduction.mid}
            crossoverInfo={`${params.crossoverLowMid} Hz - ${params.crossoverMidHigh} Hz`}
          />
          <BandControls
            bandName="High"
            bandParams={params.highBand}
            onBandParamChange={(p, v) => handleBandParamChange('highBand', p, v)}
            gainReductionDb={gainReduction.high}
            crossoverInfo={`> ${params.crossoverMidHigh} Hz`}
          />
        </div>
      )}
      {!params.enabled && (
        <p className="text-sm text-slate-400 text-center py-4">Multiband compressor is disabled.</p>
      )}
    </div>
  );
};
