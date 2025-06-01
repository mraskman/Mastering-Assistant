
import React from 'react';

interface GainReductionMeterProps {
  reductionDb: number; // Typically a negative value or 0 from compressorNode.reduction
}

const MAX_REDUCTION_DISPLAY_DB = 20; // Display up to 20dB of reduction visually

export const GainReductionMeter: React.FC<GainReductionMeterProps> = ({ reductionDb }) => {
  // Convert to positive for display and clamp
  const displayReduction = Math.min(Math.abs(reductionDb), MAX_REDUCTION_DISPLAY_DB);
  const meterPercentage = (displayReduction / MAX_REDUCTION_DISPLAY_DB) * 100;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
        <span>Gain Reduction</span>
        <span className="text-sky-300 tabular-nums">
          {Math.abs(reductionDb).toFixed(1)} dB
        </span>
      </div>
      <div className="w-full h-3 bg-slate-500 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-500 transition-all duration-50 ease-linear"
          style={{ width: `${meterPercentage}%` }}
          role="meter"
          aria-valuenow={displayReduction}
          aria-valuemin={0}
          aria-valuemax={MAX_REDUCTION_DISPLAY_DB}
          aria-label="Compressor gain reduction amount"
        ></div>
      </div>
    </div>
  );
};
