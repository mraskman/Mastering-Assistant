import React from 'react';
import { LoudnessMetrics } from '../types';
import { BarChartIcon, RefreshCwIcon } from '../assets/icons'; // Assuming BarChartIcon and RefreshCwIcon will be added

interface LoudnessMeterPanelProps {
  metrics: LoudnessMetrics;
  onReset: () => void;
}

const MeterDisplay: React.FC<{ label: string; value: number; unit: string; precision?: number }> = ({ label, value, unit, precision = 1 }) => (
  <div>
    <p className="text-xs text-slate-400">{label}</p>
    <p className={`text-lg font-semibold tabular-nums ${value < -60 ? 'text-slate-500' : 'text-sky-300'}`}>
      {isFinite(value) ? value.toFixed(precision) : '-Inf'} <span className="text-sm text-slate-400">{unit}</span>
    </p>
  </div>
);


export const LoudnessMeterPanel: React.FC<LoudnessMeterPanelProps> = ({ metrics, onReset }) => {
  return (
    <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center">
          <BarChartIcon className="w-5 h-5 mr-2 text-sky-400" /> Loudness Meter
        </h3>
        <button
          onClick={onReset}
          className="px-3 py-1 text-xs bg-slate-500 hover:bg-slate-400 text-slate-100 font-medium rounded-md shadow transition-colors flex items-center"
          aria-label="Reset loudness measurements"
        >
          <RefreshCwIcon className="w-3 h-3 mr-1.5"/> Reset
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left">
        <MeterDisplay label="Momentary" value={metrics.momentaryLufs} unit="LUFS (approx.)" />
        <MeterDisplay label="Short-Term" value={metrics.shortTermLufs} unit="LUFS (approx.)" />
        <MeterDisplay label="Integrated" value={metrics.integratedLufs} unit="LUFS (approx.)" />
        <MeterDisplay label="Peak" value={metrics.peak} unit="dBFS" />
      </div>
      <p className="text-xs text-slate-500 mt-3 text-center">
        Note: LUFS values are approximated for guidance and may differ from professional metering tools.
      </p>
    </div>
  );
};