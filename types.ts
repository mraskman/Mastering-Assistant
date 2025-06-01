
export interface EQBand {
  id: string;
  frequency: number;
  gain: number; // in dB
  type: BiquadFilterType;
  q?: number;
  label: string;
}

export interface CompressorParams {
  threshold: number; // dB
  knee: number; // dB
  ratio: number;
  attack: number; // seconds
  release: number; // seconds
}

export interface LimiterParams {
  threshold: number; // dB (effectively a ceiling)
  release: number; // seconds (for the limiter's compressor)
}

export interface ReverbParams {
  mix: number; // 0 to 1 (0% to 100%)
  decay: number; // in seconds (for synthetic IR generation)
  preDelay: number; // in seconds (0 to 1s)
  damping: number; // in Hz (frequency for low-pass filter on reverb tail)
}

export interface StereoExpanderParams {
  width: number; // 0 (mono) to 1 (normal) to 2 (double width)
}

// For Multiband Compressor
export interface MultibandCompressorBandParams {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number; // dB
}

export interface MultibandCompressorParams {
  enabled: boolean;
  crossoverLowMid: number; // Hz
  crossoverMidHigh: number; // Hz
  lowBand: MultibandCompressorBandParams;
  midBand: MultibandCompressorBandParams;
  highBand: MultibandCompressorBandParams;
}

export interface TapeSimulatorParams {
  enabled: boolean;
  drive: number; // 0 to 1, representing 0-100%
  // tone?: number; // Optional for future: -1 (dark) to 1 (bright)
  // mix?: number; // Optional for future: 0 to 1 for parallel processing
}


export interface AudioProcessingParams {
  eqBands: EQBand[];
  compressor: CompressorParams;
  multibandCompressor: MultibandCompressorParams;
  tapeSimulator: TapeSimulatorParams; // Added
  limiter: LimiterParams;
  reverb: ReverbParams;
  stereoExpander: StereoExpanderParams;
  masterVolume: number; // 0 to 2 (0-200%)
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  text: string;
  timestamp: Date;
}

export interface LoudnessMetrics {
  momentaryLufs: number;
  shortTermLufs: number;
  integratedLufs: number;
  peak: number; // dBFS
  lra?: number; // Loudness Range (optional for later)
}

export interface VisualizerSettings {
  mode: 'pre-eq' | 'post-processing';
  peakHoldEnabled: boolean;
}

export type AudioNodeMap = {
  sourceNode?: MediaElementAudioSourceNode | AudioBufferSourceNode;
  eqNodes?: BiquadFilterNode[];
  
  preEQAnalyserNode?: AnalyserNode; 
  postProcessingAnalyserNode?: AnalyserNode; 

  // Multiband Compressor Nodes
  preMultibandGain?: GainNode; 
  multibandSplitterInputNode?: GainNode; 

  lowPassFilterMB?: BiquadFilterNode; 
  bandPassFilterMBMid1?: BiquadFilterNode; 
  bandPassFilterMBMid2?: BiquadFilterNode; 
  highPassFilterMB?: BiquadFilterNode; 

  compressorNodeLowMB?: DynamicsCompressorNode;
  makeupGainNodeLowMB?: GainNode;
  compressorNodeMidMB?: DynamicsCompressorNode;
  makeupGainNodeMidMB?: GainNode;
  compressorNodeHighMB?: DynamicsCompressorNode;
  makeupGainNodeHighMB?: GainNode;

  multibandMergerNode?: GainNode; 
  postMultibandGain?: GainNode; 
  multibandCompressor?: { enabled: boolean }; // To track enabled state for metrics

  compressorNode?: DynamicsCompressorNode; 
  
  // Tape Simulator Nodes
  tapeInputGainNode?: GainNode;
  waveShaperNode?: WaveShaperNode;
  tapeOutputGainNode?: GainNode; 
  tapeBypassGainNode?: GainNode; 

  // Reverb specific nodes
  reverbPreDelayNode?: DelayNode; 
  convolverNode?: ConvolverNode;
  reverbDryGainNode?: GainNode;
  reverbWetGainNode?: GainNode;
  reverbSumGainNode?: GainNode; 

  // Stereo Expander nodes
  stereoExpanderSplitterNode?: ChannelSplitterNode;
  stereoExpanderMidCombineL?: GainNode;
  stereoExpanderMidCombineR?: GainNode;
  stereoExpanderMidChannel?: GainNode;
  stereoExpanderSideCombineL?: GainNode;
  stereoExpanderSideCombineR?: GainNode;
  stereoExpanderSideChannel?: GainNode;
  stereoExpanderSideGain?: GainNode; 
  stereoExpanderOutputL?: GainNode;
  stereoExpanderOutputRInvertSide?: GainNode;
  stereoExpanderOutputR?: GainNode;
  stereoExpanderMergerNode?: ChannelMergerNode;
  
  limiterCompressorNode?: DynamicsCompressorNode; 
  masterGainNode?: GainNode;
};
