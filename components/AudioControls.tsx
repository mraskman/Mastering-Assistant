
import React from 'react';
import { AudioProcessingParams, EQBand, CompressorParams, LimiterParams, ReverbParams, StereoExpanderParams, LoudnessMetrics, MultibandCompressorParams, MultibandCompressorBandParams, TapeSimulatorParams, VisualizerSettings } from '../types';
import { EQPanel } from './EQPanel';
import { DynamicsPanel } from './DynamicsPanel';
import { VolumeControl } from './VolumeControl';
import { Visualizer } from './Visualizer';
import { ReverbPanel } from './ReverbPanel';
import { StereoExpanderPanel } from './StereoExpanderPanel'; 
import { LoudnessMeterPanel } from './LoudnessMeterPanel'; 
import { MultibandCompressorPanel } from './MultibandCompressorPanel';
import { TapeSimulatorPanel } from './TapeSimulatorPanel';
import { RefreshCwIcon } from '../assets/icons'; // For reset peaks button

interface AudioControlsProps {
  processingParams: AudioProcessingParams;
  onParamsChange: <K extends keyof AudioProcessingParams>(
    paramType: K,
    value: AudioProcessingParams[K]
  ) => void;
  onSpecificEQBandChange: (bandId: string, gainValue: number) => void;
  preEQAnalyserNode?: AnalyserNode;
  postProcessingAnalyserNode?: AnalyserNode;
  gainReductionDb: number; 
  limiterGainReductionDb: number; 
  multibandGainReduction: { low: number, mid: number, high: number };
  loudnessMetrics: LoudnessMetrics; 
  onResetLoudness: () => void; 
  visualizerSettings: VisualizerSettings;
  onVisualizerSettingsChange: (settings: Partial<VisualizerSettings>) => void;
  onResetPeaks: () => void;
  peakHoldResetKey: number;
}

export const AudioControls: React.FC<AudioControlsProps> = ({ 
  processingParams, 
  onParamsChange, 
  onSpecificEQBandChange, 
  preEQAnalyserNode,
  postProcessingAnalyserNode,
  gainReductionDb,
  limiterGainReductionDb, 
  multibandGainReduction,
  loudnessMetrics,
  onResetLoudness,
  visualizerSettings,
  onVisualizerSettingsChange,
  onResetPeaks,
  peakHoldResetKey
}) => {
  
  const handleStereoExpanderChange = (updatedParams: StereoExpanderParams) => {
    onParamsChange('stereoExpander', updatedParams);
  };

  const handleMultibandCompressorChange = (updatedParams: MultibandCompressorParams) => {
    onParamsChange('multibandCompressor', updatedParams);
  };

  const handleTapeSimulatorChange = (updatedParams: TapeSimulatorParams) => {
    onParamsChange('tapeSimulator', updatedParams);
  };

  const selectedAnalyserNode = visualizerSettings.mode === 'pre-eq' ? preEQAnalyserNode : postProcessingAnalyserNode;

  return (
    <div className="mt-8 space-y-8">
      {selectedAnalyserNode && (
        <div className="bg-slate-600 p-4 rounded-lg shadow-inner">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
            <h3 className="text-lg font-semibold text-slate-200 mb-2 sm:mb-0">Audio Visualizer</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center space-x-1 text-xs">
                <button 
                    onClick={() => onVisualizerSettingsChange({ mode: 'pre-eq' })}
                    className={`px-2 py-1 rounded-md ${visualizerSettings.mode === 'pre-eq' ? 'bg-sky-500 text-white' : 'bg-slate-500 hover:bg-slate-400'}`}
                >Pre-EQ</button>
                <button 
                    onClick={() => onVisualizerSettingsChange({ mode: 'post-processing' })}
                    className={`px-2 py-1 rounded-md ${visualizerSettings.mode === 'post-processing' ? 'bg-sky-500 text-white' : 'bg-slate-500 hover:bg-slate-400'}`}
                >Post-Processing</button>
              </div>
              <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-slate-300">
                <input 
                    type="checkbox" 
                    checked={visualizerSettings.peakHoldEnabled}
                    onChange={(e) => onVisualizerSettingsChange({ peakHoldEnabled: e.target.checked })}
                    className="form-checkbox h-4 w-4 text-sky-500 bg-slate-500 border-slate-400 rounded focus:ring-sky-600"
                />
                <span>Peak Hold</span>
              </label>
              {visualizerSettings.peakHoldEnabled && (
                <button 
                    onClick={onResetPeaks}
                    className="px-2 py-1 text-xs bg-slate-500 hover:bg-slate-400 text-slate-100 rounded-md flex items-center"
                    aria-label="Reset peak hold"
                >
                   <RefreshCwIcon className="w-3 h-3 mr-1"/> Reset Peaks
                </button>
              )}
            </div>
          </div>
          <Visualizer 
            analyserNode={selectedAnalyserNode} 
            peakHoldEnabled={visualizerSettings.peakHoldEnabled}
            peakHoldResetKey={peakHoldResetKey}
          />
        </div>
      )}

      <EQPanel 
        bands={processingParams.eqBands} 
        onBandChange={onSpecificEQBandChange} 
      />
      <MultibandCompressorPanel
        params={processingParams.multibandCompressor}
        onParamsChange={handleMultibandCompressorChange}
        gainReduction={multibandGainReduction}
      />
      <DynamicsPanel
        compressorParams={processingParams.compressor}
        limiterParams={processingParams.limiter}
        onCompressorChange={(params) => onParamsChange('compressor', params)}
        onLimiterChange={(params) => onParamsChange('limiter', params)}
        gainReductionDb={gainReductionDb} 
        limiterGainReductionDb={limiterGainReductionDb} 
      />
      <TapeSimulatorPanel
        params={processingParams.tapeSimulator}
        onParamsChange={handleTapeSimulatorChange}
      />
      <ReverbPanel 
        reverbParams={processingParams.reverb}
        onReverbChange={(params) => onParamsChange('reverb', params)}
      />
      <StereoExpanderPanel 
        stereoExpanderParams={processingParams.stereoExpander}
        onStereoExpanderChange={handleStereoExpanderChange}
      />
      <VolumeControl
        volume={processingParams.masterVolume}
        onVolumeChange={(volume) => onParamsChange('masterVolume', volume)}
      />
      <LoudnessMeterPanel 
        metrics={loudnessMetrics}
        onReset={onResetLoudness}
      />
       <p className="text-xs text-slate-400 text-center mt-4">
        Adjust these controls based on AI suggestions or your own preferences.
      </p>
    </div>
  );
};
