
import { useRef, useCallback, useState, useEffect } from 'react';
import React from 'react'; 
import { EQBand, CompressorParams, LimiterParams, AudioProcessingParams, AudioNodeMap, ReverbParams, StereoExpanderParams, LoudnessMetrics, MultibandCompressorParams, TapeSimulatorParams, VisualizerSettings } from '../types';

export const createSyntheticImpulseResponse = (
    context: AudioContext | OfflineAudioContext, 
    decayTime: number = 1.5,
    dampingFrequency: number = 20000 
): AudioBuffer => {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * decayTime)); 
  const baseImpulse = context.createBuffer(2, length, sampleRate); 
  
  const left = baseImpulse.getChannelData(0);
  const right = baseImpulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const envelope = Math.pow(1 - t, 2.5) * Math.exp(-3 * t); 
    left[i] = (Math.random() * 2 - 1) * envelope;
    right[i] = (Math.random() * 2 - 1) * envelope;
  }

  
  if (dampingFrequency < sampleRate / 2 && dampingFrequency < 19900) { 
    // console.warn("Advanced IR damping with OfflineAudioContext is ideally an async operation. Current implementation is simplified and returns undamped IR to maintain synchronous behavior. For best results, consider making IR generation asynchronous if performance issues arise with damping changes.");
    return baseImpulse; 
  }

  return baseImpulse;
};

function makeDistortionCurve(drivePercentage: number, samples: number = 4096): Float32Array {
    const k = drivePercentage * 10; 
    const curve = new Float32Array(samples);
    const n_samples = samples; 
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1; 
        curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
    }
    return curve;
}


const MOMENTARY_WINDOW_MS = 400;
const SHORT_TERM_WINDOW_MS = 3000;

export function useAudioProcessor(audioElementRef: React.RefObject<HTMLAudioElement>) {
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const nodesRef = React.useRef<AudioNodeMap>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [gainReductionDb, setGainReductionDb] = useState(0);
  const [limiterGainReductionDb, setLimiterGainReductionDb] = useState(0); 
  const [multibandGainReduction, setMultibandGainReduction] = useState({ low: 0, mid: 0, high: 0 });
  
  const [loudnessMetrics, setLoudnessMetrics] = useState<LoudnessMetrics>({
    momentaryLufs: -70,
    shortTermLufs: -70,
    integratedLufs: -70,
    peak: -Infinity,
  });

  const timeDomainDataRef = React.useRef<Float32Array | null>(null);
  const momentarySamplesBufferRef = React.useRef<number[]>([]);
  const shortTermSamplesBufferRef = React.useRef<number[]>([]);
  const integratedPowerSumRef = React.useRef<number>(0);
  const integratedSampleCountRef = React.useRef<number>(0);
  
  const animationFrameIdRef = React.useRef<number | undefined>(undefined);
  const lastReverbDecayRef = React.useRef<number | null>(null);
  const lastReverbDampingRef = React.useRef<number | null>(null);


  const resetLoudnessMeasurements = useCallback(() => {
    setLoudnessMetrics({
      momentaryLufs: -70,
      shortTermLufs: -70,
      integratedLufs: -70,
      peak: -Infinity,
    });
    momentarySamplesBufferRef.current = [];
    shortTermSamplesBufferRef.current = [];
    integratedPowerSumRef.current = 0;
    integratedSampleCountRef.current = 0;
  }, []);

  const initializeAudioNodes = useCallback((
    context: AudioContext | OfflineAudioContext, 
    params: AudioProcessingParams, 
    sourceNodeForOffline?: AudioBufferSourceNode,
    htmlAudioElement?: HTMLMediaElement | null 
  ) => {
    const localNodes: AudioNodeMap = {};
    const C = context.currentTime;

    let sourceNode: MediaElementAudioSourceNode | AudioBufferSourceNode | undefined = sourceNodeForOffline;
    if (!sourceNode && context instanceof AudioContext) {
      if (htmlAudioElement && htmlAudioElement instanceof HTMLMediaElement) {
        try {
          sourceNode = context.createMediaElementSource(htmlAudioElement);
          console.log("MediaElementAudioSourceNode created successfully.");
        } catch (e) {
          console.error("Error creating MediaElementAudioSourceNode in initializeAudioNodes:", e instanceof Error ? e.message : String(e));
        }
      } else if (htmlAudioElement) {
        console.error("Passed htmlAudioElement is not an HTMLMediaElement instance in initializeAudioNodes:", htmlAudioElement);
      }
    }
    localNodes.sourceNode = sourceNode;
    
    if (!localNodes.sourceNode) {
        console.error("Failed to create source node. Context type:", context?.constructor?.name, "Audio element provided:", !!htmlAudioElement, "SourceNodeForOffline:", !!sourceNodeForOffline);
        throw new Error("Audio source node could not be created.");
    }

    let currentNode: AudioNode = localNodes.sourceNode;

    if (context instanceof AudioContext) { 
        localNodes.preEQAnalyserNode = context.createAnalyser();
        localNodes.preEQAnalyserNode.fftSize = 2048;
        localNodes.preEQAnalyserNode.smoothingTimeConstant = 0.8; 
        if (localNodes.sourceNode instanceof AudioNode) { 
            (localNodes.sourceNode as AudioNode).connect(localNodes.preEQAnalyserNode);
        }
    }

    localNodes.eqNodes = params.eqBands.map(band => {
      const filter = context.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.setValueAtTime(band.frequency, C);
      filter.gain.setValueAtTime(band.gain, C);
      if (band.q) filter.Q.setValueAtTime(band.q, C);
      return filter;
    });
    localNodes.eqNodes.forEach(eqNode => { currentNode.connect(eqNode); currentNode = eqNode; });

    const nodeBeforeMultiband = currentNode; 
    localNodes.preMultibandGain = context.createGain(); 
    localNodes.multibandMergerNode = context.createGain(); 

    const mbParams = params.multibandCompressor;
    if (mbParams.enabled) {
      nodeBeforeMultiband.connect(localNodes.preMultibandGain);
      
      localNodes.lowPassFilterMB = context.createBiquadFilter();
      localNodes.lowPassFilterMB.type = 'lowpass';
      localNodes.lowPassFilterMB.frequency.setValueAtTime(mbParams.crossoverLowMid, C);
      localNodes.lowPassFilterMB.Q.setValueAtTime(0.7071, C); 
      localNodes.compressorNodeLowMB = context.createDynamicsCompressor();
      localNodes.makeupGainNodeLowMB = context.createGain();
      localNodes.preMultibandGain.connect(localNodes.lowPassFilterMB)
          .connect(localNodes.compressorNodeLowMB)
          .connect(localNodes.makeupGainNodeLowMB)
          .connect(localNodes.multibandMergerNode);

      localNodes.bandPassFilterMBMid1 = context.createBiquadFilter(); 
      localNodes.bandPassFilterMBMid1.type = 'highpass';
      localNodes.bandPassFilterMBMid1.frequency.setValueAtTime(mbParams.crossoverLowMid, C);
      localNodes.bandPassFilterMBMid1.Q.setValueAtTime(0.7071, C);
      localNodes.bandPassFilterMBMid2 = context.createBiquadFilter(); 
      localNodes.bandPassFilterMBMid2.type = 'lowpass';
      localNodes.bandPassFilterMBMid2.frequency.setValueAtTime(mbParams.crossoverMidHigh, C);
      localNodes.bandPassFilterMBMid2.Q.setValueAtTime(0.7071, C);
      localNodes.compressorNodeMidMB = context.createDynamicsCompressor();
      localNodes.makeupGainNodeMidMB = context.createGain();
      localNodes.preMultibandGain.connect(localNodes.bandPassFilterMBMid1)
          .connect(localNodes.bandPassFilterMBMid2)
          .connect(localNodes.compressorNodeMidMB)
          .connect(localNodes.makeupGainNodeMidMB)
          .connect(localNodes.multibandMergerNode);
      
      localNodes.highPassFilterMB = context.createBiquadFilter();
      localNodes.highPassFilterMB.type = 'highpass';
      localNodes.highPassFilterMB.frequency.setValueAtTime(mbParams.crossoverMidHigh, C);
      localNodes.highPassFilterMB.Q.setValueAtTime(0.7071, C);
      localNodes.compressorNodeHighMB = context.createDynamicsCompressor();
      localNodes.makeupGainNodeHighMB = context.createGain();
      localNodes.preMultibandGain.connect(localNodes.highPassFilterMB)
          .connect(localNodes.compressorNodeHighMB)
          .connect(localNodes.makeupGainNodeHighMB)
          .connect(localNodes.multibandMergerNode);
      
      currentNode = localNodes.multibandMergerNode;
      localNodes.multibandCompressor = { enabled: true };
    } else {
      currentNode = nodeBeforeMultiband;
      localNodes.multibandCompressor = { enabled: false };
    }

    const compressorNode = context.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(params.compressor.threshold, C);
    compressorNode.knee.setValueAtTime(params.compressor.knee, C);
    compressorNode.ratio.setValueAtTime(params.compressor.ratio, C);
    compressorNode.attack.setValueAtTime(params.compressor.attack, C);
    compressorNode.release.setValueAtTime(params.compressor.release, C);
    localNodes.compressorNode = compressorNode;
    currentNode.connect(compressorNode); 
    currentNode = compressorNode;

    // Tape Simulator
    const tapeParams = params.tapeSimulator;
    localNodes.tapeInputGainNode = context.createGain();
    localNodes.waveShaperNode = context.createWaveShaper();
    localNodes.waveShaperNode.curve = makeDistortionCurve(tapeParams.drive);
    localNodes.waveShaperNode.oversample = '4x';
    localNodes.tapeOutputGainNode = context.createGain(); 
    localNodes.tapeBypassGainNode = context.createGain(); 
    const nodeBeforeTape = currentNode;
    if (tapeParams.enabled) {
      nodeBeforeTape.connect(localNodes.tapeInputGainNode);
      localNodes.tapeInputGainNode.connect(localNodes.waveShaperNode);
      localNodes.waveShaperNode.connect(localNodes.tapeOutputGainNode);
      currentNode = localNodes.tapeOutputGainNode;
      localNodes.tapeBypassGainNode.gain.setValueAtTime(0, C);
      localNodes.tapeInputGainNode.gain.setValueAtTime(1 + tapeParams.drive * 0.25, C); 
      localNodes.tapeOutputGainNode.gain.setValueAtTime(1 / (1 + tapeParams.drive * 0.05), C); 
    } else {
      nodeBeforeTape.connect(localNodes.tapeBypassGainNode); 
      currentNode = localNodes.tapeBypassGainNode;
      localNodes.tapeBypassGainNode.gain.setValueAtTime(1, C); 
      localNodes.tapeInputGainNode.gain.setValueAtTime(0, C); 
      localNodes.tapeOutputGainNode.gain.setValueAtTime(0, C); 
    }

    // Stereo Expander (Moved before Reverb)
    const isStereoSource = (context instanceof AudioContext && localNodes.sourceNode instanceof MediaElementAudioSourceNode && localNodes.sourceNode.channelCount === 2) || 
                           (sourceNodeForOffline && sourceNodeForOffline.buffer && sourceNodeForOffline.buffer.numberOfChannels === 2);
    const nodeBeforeStereoExpander = currentNode;

    if (isStereoSource) {
        localNodes.stereoExpanderSplitterNode = context.createChannelSplitter(2);
        localNodes.stereoExpanderMidCombineL = context.createGain(); localNodes.stereoExpanderMidCombineL.gain.value = 0.5;
        localNodes.stereoExpanderMidCombineR = context.createGain(); localNodes.stereoExpanderMidCombineR.gain.value = 0.5;
        localNodes.stereoExpanderMidChannel = context.createGain();
        localNodes.stereoExpanderSideCombineL = context.createGain(); localNodes.stereoExpanderSideCombineL.gain.value = 0.5;
        localNodes.stereoExpanderSideCombineR = context.createGain(); localNodes.stereoExpanderSideCombineR.gain.value = -0.5;
        localNodes.stereoExpanderSideChannel = context.createGain();
        localNodes.stereoExpanderSideGain = context.createGain(); localNodes.stereoExpanderSideGain.gain.value = params.stereoExpander.width;
        localNodes.stereoExpanderOutputL = context.createGain();
        localNodes.stereoExpanderOutputRInvertSide = context.createGain(); localNodes.stereoExpanderOutputRInvertSide.gain.value = -1.0;
        localNodes.stereoExpanderOutputR = context.createGain();
        localNodes.stereoExpanderMergerNode = context.createChannelMerger(2);

        nodeBeforeStereoExpander.connect(localNodes.stereoExpanderSplitterNode);
        localNodes.stereoExpanderSplitterNode.connect(localNodes.stereoExpanderMidCombineL, 0);
        localNodes.stereoExpanderSplitterNode.connect(localNodes.stereoExpanderMidCombineR, 1);
        localNodes.stereoExpanderSplitterNode.connect(localNodes.stereoExpanderSideCombineL, 0);
        localNodes.stereoExpanderSplitterNode.connect(localNodes.stereoExpanderSideCombineR, 1);

        localNodes.stereoExpanderMidCombineL.connect(localNodes.stereoExpanderMidChannel);
        localNodes.stereoExpanderMidCombineR.connect(localNodes.stereoExpanderMidChannel);
        localNodes.stereoExpanderSideCombineL.connect(localNodes.stereoExpanderSideChannel);
        localNodes.stereoExpanderSideCombineR.connect(localNodes.stereoExpanderSideChannel);
        
        localNodes.stereoExpanderSideChannel.connect(localNodes.stereoExpanderSideGain);

        localNodes.stereoExpanderMidChannel.connect(localNodes.stereoExpanderOutputL);
        localNodes.stereoExpanderSideGain.connect(localNodes.stereoExpanderOutputL);

        localNodes.stereoExpanderMidChannel.connect(localNodes.stereoExpanderOutputR);
        localNodes.stereoExpanderSideGain.connect(localNodes.stereoExpanderOutputRInvertSide);
        localNodes.stereoExpanderOutputRInvertSide.connect(localNodes.stereoExpanderOutputR);

        localNodes.stereoExpanderOutputL.connect(localNodes.stereoExpanderMergerNode, 0, 0);
        localNodes.stereoExpanderOutputR.connect(localNodes.stereoExpanderMergerNode, 0, 1);
        currentNode = localNodes.stereoExpanderMergerNode; 
    } else {
        currentNode = nodeBeforeStereoExpander; // Pass through if not stereo
    }
    
    // Reverb (Now after Stereo Expander)
    lastReverbDecayRef.current = params.reverb.decay; 
    lastReverbDampingRef.current = params.reverb.damping;
    localNodes.reverbPreDelayNode = context.createDelay(Math.max(0.001, params.reverb.preDelay + 0.1)); 
    localNodes.reverbPreDelayNode.delayTime.setValueAtTime(params.reverb.preDelay, C);
    localNodes.convolverNode = context.createConvolver();
    localNodes.convolverNode.buffer = createSyntheticImpulseResponse(context, params.reverb.decay, params.reverb.damping);
    localNodes.reverbDryGainNode = context.createGain();
    localNodes.reverbDryGainNode.gain.setValueAtTime(1.0 - params.reverb.mix, C);
    localNodes.reverbWetGainNode = context.createGain();
    localNodes.reverbWetGainNode.gain.setValueAtTime(params.reverb.mix, C);
    localNodes.reverbSumGainNode = context.createGain(); 
    const nodeBeforeReverb = currentNode; 
    nodeBeforeReverb.connect(localNodes.reverbDryGainNode); 
    nodeBeforeReverb.connect(localNodes.reverbPreDelayNode);
    localNodes.reverbPreDelayNode.connect(localNodes.convolverNode);
    localNodes.convolverNode.connect(localNodes.reverbWetGainNode);
    localNodes.reverbDryGainNode.connect(localNodes.reverbSumGainNode);
    localNodes.reverbWetGainNode.connect(localNodes.reverbSumGainNode);
    currentNode = localNodes.reverbSumGainNode; 

    // Limiter
    const limiterCompressorNode = context.createDynamicsCompressor();
    limiterCompressorNode.threshold.setValueAtTime(params.limiter.threshold, C);
    limiterCompressorNode.knee.setValueAtTime(0, C); 
    limiterCompressorNode.ratio.setValueAtTime(20, C); 
    limiterCompressorNode.attack.setValueAtTime(0.001, C); 
    limiterCompressorNode.release.setValueAtTime(params.limiter.release, C);
    localNodes.limiterCompressorNode = limiterCompressorNode;
    currentNode.connect(limiterCompressorNode);
    currentNode = limiterCompressorNode;

    // Master Volume
    localNodes.masterGainNode = context.createGain();
    localNodes.masterGainNode.gain.setValueAtTime(params.masterVolume, C);
    currentNode.connect(localNodes.masterGainNode);
    
    if (context instanceof AudioContext) { 
        localNodes.postProcessingAnalyserNode = context.createAnalyser(); 
        localNodes.postProcessingAnalyserNode.fftSize = 2048; 
        localNodes.postProcessingAnalyserNode.smoothingTimeConstant = 0.8; 
        localNodes.masterGainNode.connect(localNodes.postProcessingAnalyserNode); 
        localNodes.postProcessingAnalyserNode.connect(context.destination);
        if (!timeDomainDataRef.current || timeDomainDataRef.current.length !== localNodes.postProcessingAnalyserNode.fftSize) {
            timeDomainDataRef.current = new Float32Array(localNodes.postProcessingAnalyserNode.fftSize);
        }
    } else { 
        localNodes.masterGainNode.connect(context.destination);
    }
    
    if (mbParams.enabled && localNodes.compressorNodeLowMB && localNodes.compressorNodeMidMB && localNodes.compressorNodeHighMB && localNodes.makeupGainNodeLowMB && localNodes.makeupGainNodeMidMB && localNodes.makeupGainNodeHighMB) {
      const { lowBand, midBand, highBand } = mbParams;
      [
        { comp: localNodes.compressorNodeLowMB, makeup: localNodes.makeupGainNodeLowMB, params: lowBand },
        { comp: localNodes.compressorNodeMidMB, makeup: localNodes.makeupGainNodeMidMB, params: midBand },
        { comp: localNodes.compressorNodeHighMB, makeup: localNodes.makeupGainNodeHighMB, params: highBand },
      ].forEach(b => {
        b.comp.threshold.setValueAtTime(b.params.threshold, C);
        b.comp.knee.setValueAtTime(b.params.knee, C);
        b.comp.ratio.setValueAtTime(b.params.ratio, C);
        b.comp.attack.setValueAtTime(b.params.attack, C);
        b.comp.release.setValueAtTime(b.params.release, C);
        b.makeup.gain.setValueAtTime(Math.pow(10, b.params.makeupGain / 20), C);
      });
    }
    return localNodes;
  }, []);


  const initializeAudio = useCallback(async (initialParams: AudioProcessingParams) => {
    const currentAudioEl = audioElementRef.current;
    if (!currentAudioEl) {
      console.warn("initializeAudio called but audioElementRef is null.");
      setIsInitialized(false);
      return;
    }

    if (audioContextRef.current) {
      console.log("initializeAudio: Cleaning up previous AudioContext.");
      if (nodesRef.current.sourceNode && nodesRef.current.sourceNode instanceof MediaElementAudioSourceNode) {
        try {
          nodesRef.current.sourceNode.disconnect();
          console.info("Disconnected previous MediaElementAudioSourceNode from all outputs.");
        } catch (e) {
          console.warn("Could not disconnect previous source node:", e instanceof Error ? e.message : String(e));
        }
      }
      if (audioContextRef.current.state !== 'closed') {
        try {
          await audioContextRef.current.close();
          console.info("Previous AudioContext closed successfully.");
        } catch (e) {
          console.error("Error closing previous AudioContext:", e instanceof Error ? e.message : String(e));
        }
      }
    }
    
    audioContextRef.current = null;
    nodesRef.current = {}; 
    setIsInitialized(false); 
    
    try {
      console.log("initializeAudio: Creating new AudioContext.");
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;
      
      const freshAudioEl = audioElementRef.current; 
      if (!freshAudioEl) {
          throw new Error("Audio element became null during re-initialization.");
      }

      nodesRef.current = initializeAudioNodes(context, initialParams, undefined, freshAudioEl);
      setIsInitialized(true);
      resetLoudnessMeasurements(); 
      console.log("initializeAudio: New AudioContext and nodes initialized.");
    } catch (error) {
      console.error("Failed to initialize Web Audio API in initializeAudio:", error instanceof Error ? error.message : String(error));
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(e => console.error("Error closing new context after init failure:", e instanceof Error ? e.message : String(e)));
      }
      audioContextRef.current = null;
      setIsInitialized(false);
    }
  }, [audioElementRef, initializeAudioNodes, resetLoudnessMeasurements]);

  useEffect(() => {
    let isActive = true; 
    let currentAnalyser: AnalyserNode | undefined;

    if (isInitialized && audioElementRef.current && audioContextRef.current) {
      currentAnalyser = nodesRef.current.postProcessingAnalyserNode;

      if (currentAnalyser) {
        const analyser = currentAnalyser;
        const dataArray = timeDomainDataRef.current; 
        const sampleRate = audioContextRef.current.sampleRate;
        const samplesPerMomentaryWindow = (MOMENTARY_WINDOW_MS / 1000) * sampleRate;
        const samplesPerShortTermWindow = (SHORT_TERM_WINDOW_MS / 1000) * sampleRate;

        const updateMetrics = (time: DOMHighResTimeStamp) => { 
          if (!isActive || !dataArray || !audioElementRef.current || audioElementRef.current.paused || !analyser) {
            if (isActive && animationFrameIdRef.current !== undefined) animationFrameIdRef.current = requestAnimationFrame(updateMetrics);
            return;
          }

          setGainReductionDb(nodesRef.current.compressorNode?.reduction || 0);
          setLimiterGainReductionDb(nodesRef.current.limiterCompressorNode?.reduction || 0);
          if (nodesRef.current.multibandCompressor?.enabled && nodesRef.current.compressorNodeLowMB && nodesRef.current.compressorNodeMidMB && nodesRef.current.compressorNodeHighMB) {
              setMultibandGainReduction({
                  low: nodesRef.current.compressorNodeLowMB.reduction,
                  mid: nodesRef.current.compressorNodeMidMB.reduction,
                  high: nodesRef.current.compressorNodeHighMB.reduction,
              });
          } else {
              setMultibandGainReduction({ low: 0, mid: 0, high: 0 });
          }
          
          analyser.getFloatTimeDomainData(dataArray);
          let sumOfSquares = 0;
          let currentFramePeak = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const sampleVal = dataArray[i];
            sumOfSquares += sampleVal * sampleVal;
            if (Math.abs(sampleVal) > currentFramePeak) {
              currentFramePeak = Math.abs(sampleVal);
            }
          }
          const rms = Math.sqrt(sumOfSquares / dataArray.length);
          
          const currentPeakDb = 20 * Math.log10(currentFramePeak);
          
          setLoudnessMetrics(prevMetrics => {
              let newGlobalPeak = prevMetrics.peak;
              if (currentPeakDb > newGlobalPeak) {
                  newGlobalPeak = currentPeakDb;
              }

              const rmsDb = 20 * Math.log10(rms) + 0.691; 

              if (isFinite(rmsDb)) {
                  momentarySamplesBufferRef.current.push(rmsDb);
                  shortTermSamplesBufferRef.current.push(rmsDb);
                  
                  integratedPowerSumRef.current += sumOfSquares; 
                  integratedSampleCountRef.current += dataArray.length;
              }

              while (momentarySamplesBufferRef.current.length > (samplesPerMomentaryWindow / dataArray.length)) {
                  momentarySamplesBufferRef.current.shift();
              }
              while (shortTermSamplesBufferRef.current.length > (samplesPerShortTermWindow / dataArray.length)) {
                  shortTermSamplesBufferRef.current.shift();
              }

              const calculateAverageDb = (buffer: number[]) => buffer.length > 0 ? buffer.reduce((acc, val) => acc + val, 0) / buffer.length : -70;
              
              const momentaryLufs = calculateAverageDb(momentarySamplesBufferRef.current);
              const shortTermLufs = calculateAverageDb(shortTermSamplesBufferRef.current);
              
              let integratedLufs = -70;
              if (integratedSampleCountRef.current > 0) {
                  const meanSquareIntegrated = integratedPowerSumRef.current / integratedSampleCountRef.current;
                  const rmsIntegrated = Math.sqrt(meanSquareIntegrated);
                  integratedLufs = 20 * Math.log10(rmsIntegrated) + 0.691;
              }
              
              return {
                  momentaryLufs: isFinite(momentaryLufs) ? momentaryLufs : -70,
                  shortTermLufs: isFinite(shortTermLufs) ? shortTermLufs : -70,
                  integratedLufs: isFinite(integratedLufs) ? integratedLufs : -70,
                  peak: isFinite(newGlobalPeak) ? newGlobalPeak : -Infinity
              };
          });

          if (isActive) animationFrameIdRef.current = requestAnimationFrame(updateMetrics);
        };
        animationFrameIdRef.current = requestAnimationFrame(updateMetrics);
      }
    } else {
      if (animationFrameIdRef.current !== undefined) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = undefined; 
      }
      setGainReductionDb(0);
      setLimiterGainReductionDb(0);
      setMultibandGainReduction({ low: 0, mid: 0, high: 0 });
    }
    return () => {
      isActive = false;
      if (animationFrameIdRef.current !== undefined) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = undefined; 
      }
    };
  }, [isInitialized, audioElementRef]); 


  const updateEQ = useCallback((bands: EQBand[]) => {
    if (!audioContextRef.current || !nodesRef.current.eqNodes) return;
    const C = audioContextRef.current.currentTime;
    nodesRef.current.eqNodes.forEach((filterNode, index) => {
      const bandParams = bands[index];
      if (bandParams) {
        filterNode.frequency.setValueAtTime(bandParams.frequency, C);
        filterNode.gain.setValueAtTime(bandParams.gain, C);
        if (bandParams.q && filterNode.Q) {
          filterNode.Q.setValueAtTime(bandParams.q, C);
        }
      }
    });
  }, []);

  const updateCompressor = useCallback((params: CompressorParams) => {
    if (!audioContextRef.current || !nodesRef.current.compressorNode) return;
    const C = audioContextRef.current.currentTime;
    const comp = nodesRef.current.compressorNode;
    comp.threshold.setValueAtTime(params.threshold, C);
    comp.knee.setValueAtTime(params.knee, C);
    comp.ratio.setValueAtTime(params.ratio, C);
    comp.attack.setValueAtTime(params.attack, C);
    comp.release.setValueAtTime(params.release, C);
  }, []);

  const updateMultibandCompressor = useCallback((params: MultibandCompressorParams) => {
    if (!audioContextRef.current) return;
    const C = audioContextRef.current.currentTime;
    const { 
      preMultibandGain, 
      multibandMergerNode, 
      compressorNodeLowMB, makeupGainNodeLowMB, 
      compressorNodeMidMB, makeupGainNodeMidMB, 
      compressorNodeHighMB, makeupGainNodeHighMB,
      lowPassFilterMB, bandPassFilterMBMid1, bandPassFilterMBMid2, highPassFilterMB 
    } = nodesRef.current;

    const eqNodes = nodesRef.current.eqNodes;
    const mainCompressorNode = nodesRef.current.compressorNode;

    if (!eqNodes || eqNodes.length === 0 || !mainCompressorNode || !preMultibandGain || !multibandMergerNode) {
        console.warn("Multiband Compressor update: Missing critical nodes for routing.");
        return;
    }
    
    const nodeBeforeMultiband = eqNodes[eqNodes.length - 1];
    const nodeAfterMultiband = mainCompressorNode;

    try { nodeBeforeMultiband.disconnect(); } catch (e) { /* ignore if not connected */ }
    try { if (multibandMergerNode) multibandMergerNode.disconnect(); } catch (e) { /* ignore */ }
    try { if (preMultibandGain) preMultibandGain.disconnect(); } catch(e) {/*ignore*/}


    if (params.enabled) {
        if (!compressorNodeLowMB || !compressorNodeMidMB || !compressorNodeHighMB || !makeupGainNodeLowMB || !makeupGainNodeMidMB || !makeupGainNodeHighMB || !lowPassFilterMB || !bandPassFilterMBMid1 || !bandPassFilterMBMid2 || !highPassFilterMB) {
            console.warn("Multiband Compressor enabled but some internal nodes are missing. Bypassing.");
            nodeBeforeMultiband.connect(nodeAfterMultiband);
            if (nodesRef.current) nodesRef.current.multibandCompressor = { enabled: false };
            setMultibandGainReduction({ low: 0, mid: 0, high: 0 });
            return;
        }
        
        nodeBeforeMultiband.connect(preMultibandGain);
        
        if(lowPassFilterMB && compressorNodeLowMB && makeupGainNodeLowMB){
            preMultibandGain.connect(lowPassFilterMB).connect(compressorNodeLowMB).connect(makeupGainNodeLowMB).connect(multibandMergerNode);
        }
        if(bandPassFilterMBMid1 && bandPassFilterMBMid2 && compressorNodeMidMB && makeupGainNodeMidMB){
            preMultibandGain.connect(bandPassFilterMBMid1).connect(bandPassFilterMBMid2).connect(compressorNodeMidMB).connect(makeupGainNodeMidMB).connect(multibandMergerNode);
        }
        if(highPassFilterMB && compressorNodeHighMB && makeupGainNodeHighMB){
            preMultibandGain.connect(highPassFilterMB).connect(compressorNodeHighMB).connect(makeupGainNodeHighMB).connect(multibandMergerNode);
        }
        multibandMergerNode.connect(nodeAfterMultiband);

        const { lowBand, midBand, highBand, crossoverLowMid, crossoverMidHigh } = params;
        if (lowPassFilterMB) lowPassFilterMB.frequency.setValueAtTime(crossoverLowMid, C);
        if (bandPassFilterMBMid1) bandPassFilterMBMid1.frequency.setValueAtTime(crossoverLowMid, C);
        if (bandPassFilterMBMid2) bandPassFilterMBMid2.frequency.setValueAtTime(crossoverMidHigh, C);
        if (highPassFilterMB) highPassFilterMB.frequency.setValueAtTime(crossoverMidHigh, C);
        
        const bandNodes = [
            { comp: compressorNodeLowMB, makeup: makeupGainNodeLowMB, params: lowBand },
            { comp: compressorNodeMidMB, makeup: makeupGainNodeMidMB, params: midBand },
            { comp: compressorNodeHighMB, makeup: makeupGainNodeHighMB, params: highBand },
        ];

        bandNodes.forEach(b => {
            if (b.comp && b.makeup) {
                b.comp.threshold.setValueAtTime(b.params.threshold, C);
                b.comp.knee.setValueAtTime(b.params.knee, C);
                b.comp.ratio.setValueAtTime(b.params.ratio, C);
                b.comp.attack.setValueAtTime(b.params.attack, C);
                b.comp.release.setValueAtTime(b.params.release, C);
                b.makeup.gain.setValueAtTime(Math.pow(10, b.params.makeupGain / 20), C);
            }
        });
        if (nodesRef.current) nodesRef.current.multibandCompressor = { enabled: true };

    } else {
        nodeBeforeMultiband.connect(nodeAfterMultiband);
        setMultibandGainReduction({ low: 0, mid: 0, high: 0 }); 
        if (nodesRef.current) nodesRef.current.multibandCompressor = { enabled: false };
    }
  }, []);

  const updateTapeSimulator = useCallback((params: TapeSimulatorParams) => {
    if (!audioContextRef.current || !nodesRef.current.waveShaperNode || !nodesRef.current.tapeInputGainNode || !nodesRef.current.tapeOutputGainNode || !nodesRef.current.tapeBypassGainNode) return;
    
    const context = audioContextRef.current;
    const C = context.currentTime;
    const { tapeInputGainNode, waveShaperNode, tapeOutputGainNode, tapeBypassGainNode } = nodesRef.current;
    
    const nodeBeforeTape = nodesRef.current.compressorNode; 
    
    // Determine the node directly after the tape simulator module in the chain
    // This is now Stereo Expander if it's built, otherwise Reverb's pre-delay/dry path.
    let nodeAfterTapeModule: AudioNode | undefined = undefined;
    if (nodesRef.current.stereoExpanderSplitterNode) { // If stereo expander is built and used
        nodeAfterTapeModule = nodesRef.current.stereoExpanderSplitterNode;
    } else if (nodesRef.current.reverbPreDelayNode && nodesRef.current.reverbDryGainNode) { // Else if reverb nodes exist (mono or stereo expander not built)
        nodeAfterTapeModule = nodesRef.current.reverbPreDelayNode; // One path for reverb
                                                                     // Dry path also needed
    } else if (nodesRef.current.limiterCompressorNode) { // Fallback to limiter if reverb also not present
        nodeAfterTapeModule = nodesRef.current.limiterCompressorNode;
    }


    if (!nodeBeforeTape || !nodeAfterTapeModule) {
        console.error("Cannot update tape simulator: Missing critical connection points (nodeBeforeTape or effective nodeAfterTapeModule).");
        return;
    }

    try { nodeBeforeTape.disconnect(tapeInputGainNode); } catch (e) { /* ignore if not connected */ }
    try { nodeBeforeTape.disconnect(tapeBypassGainNode); } catch (e) { /* ignore if not connected */ }
    
    try { if (tapeOutputGainNode) tapeOutputGainNode.disconnect(); } catch (e) { /* ignore */ }
    try { if (tapeBypassGainNode) tapeBypassGainNode.disconnect(); } catch (e) { /* ignore */ }


    if (params.enabled) {
        tapeInputGainNode.gain.setValueAtTime(1 + params.drive * 0.25, C); 
        waveShaperNode.curve = makeDistortionCurve(params.drive); 
        tapeOutputGainNode.gain.setValueAtTime(1 / (1 + params.drive * 0.05), C);
        tapeBypassGainNode.gain.setValueAtTime(0, C); 

        nodeBeforeTape.connect(tapeInputGainNode);
        tapeInputGainNode.connect(waveShaperNode);
        waveShaperNode.connect(tapeOutputGainNode);
        
        tapeOutputGainNode.connect(nodeAfterTapeModule);
        // If nodeAfterTapeModule is reverbPreDelay, also connect to reverbDryGain
        if (nodeAfterTapeModule === nodesRef.current.reverbPreDelayNode && nodesRef.current.reverbDryGainNode) {
            tapeOutputGainNode.connect(nodesRef.current.reverbDryGainNode);
        }


    } else {
        tapeInputGainNode.gain.setValueAtTime(0, C); 
        tapeOutputGainNode.gain.setValueAtTime(0, C); 
        tapeBypassGainNode.gain.setValueAtTime(1, C); 

        nodeBeforeTape.connect(tapeBypassGainNode);
        tapeBypassGainNode.connect(nodeAfterTapeModule);
        // If nodeAfterTapeModule is reverbPreDelay, also connect to reverbDryGain
        if (nodeAfterTapeModule === nodesRef.current.reverbPreDelayNode && nodesRef.current.reverbDryGainNode) {
            tapeBypassGainNode.connect(nodesRef.current.reverbDryGainNode);
        }
    }
  }, []);


  const updateReverb = useCallback((params: ReverbParams) => {
    if (!audioContextRef.current || !nodesRef.current.reverbDryGainNode || !nodesRef.current.reverbWetGainNode || !nodesRef.current.convolverNode || !nodesRef.current.reverbPreDelayNode) return;
    
    const context = audioContextRef.current;
    const C = context.currentTime;
    const convolverNode = nodesRef.current.convolverNode;
    const preDelayNode = nodesRef.current.reverbPreDelayNode;

    preDelayNode.delayTime.setValueAtTime(params.preDelay, C);
    
    const decayChanged = params.decay !== lastReverbDecayRef.current && Math.abs(params.decay - (lastReverbDecayRef.current ?? params.decay)) > 0.01;
    const dampingChanged = params.damping !== lastReverbDampingRef.current && Math.abs(params.damping - (lastReverbDampingRef.current ?? params.damping)) > 10; 

    if (decayChanged || dampingChanged) {
      try {
        const newImpulseResponse = createSyntheticImpulseResponse(context, params.decay, params.damping);
        convolverNode.buffer = newImpulseResponse;
        lastReverbDecayRef.current = params.decay;
        lastReverbDampingRef.current = params.damping;
      } catch (e) {
        console.error("Error creating or setting new impulse response:", e instanceof Error ? e.message : String(e));
      }
    }
    
    nodesRef.current.reverbDryGainNode.gain.setValueAtTime(1.0 - params.mix, C);
    nodesRef.current.reverbWetGainNode.gain.setValueAtTime(params.mix, C);
  }, []); 

  const updateStereoExpander = useCallback((params: StereoExpanderParams) => {
    if (!audioContextRef.current || !nodesRef.current.stereoExpanderSideGain) return;
    nodesRef.current.stereoExpanderSideGain.gain.setValueAtTime(params.width, audioContextRef.current.currentTime);
  }, []);

  const updateLimiter = useCallback((params: LimiterParams) => {
    if (!audioContextRef.current || !nodesRef.current.limiterCompressorNode) return;
    const C = audioContextRef.current.currentTime;
    const limiterComp = nodesRef.current.limiterCompressorNode;
    limiterComp.threshold.setValueAtTime(params.threshold, C);
    limiterComp.release.setValueAtTime(params.release, C);
  }, []);

  const updateMasterVolume = useCallback((volume: number) => {
    if (!audioContextRef.current || !nodesRef.current.masterGainNode) return;
    nodesRef.current.masterGainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
  }, []);

  const getOfflineAudioContext = useCallback((originalBuffer: AudioBuffer, targetSampleRate: number, params: AudioProcessingParams) => {
    const duration = originalBuffer.duration;
    const numberOfChannels = originalBuffer.numberOfChannels;
    const offlineCtx = new OfflineAudioContext(numberOfChannels, Math.ceil(duration * targetSampleRate), targetSampleRate);
    
    const sourceNode = offlineCtx.createBufferSource(); 
    sourceNode.buffer = originalBuffer; 

    const offlineNodes = initializeAudioNodes(offlineCtx, params, sourceNode, null); 
    
    return {
        context: offlineCtx,
        inputNode: offlineNodes.sourceNode as AudioBufferSourceNode, 
    };
  }, [initializeAudioNodes]);


  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== undefined) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = undefined; 
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.error("Error closing AudioContext on unmount:", e instanceof Error ? e.message : String(e)));
      }
      audioContextRef.current = null;
      nodesRef.current = {};
      setIsInitialized(false); 
    };
  }, []); 

  const isAudioContextInitialized = useCallback(() => {
    return !!(audioContextRef.current && isInitialized);
  }, [isInitialized]);

  const getAudioContext = useCallback(() => { 
    return audioContextRef.current;
  }, []);

  return { 
    initializeAudio, 
    updateEQ, 
    updateCompressor, 
    updateMultibandCompressor,
    updateTapeSimulator,
    updateLimiter, 
    updateReverb,
    updateStereoExpander,
    updateMasterVolume, 
    isAudioContextInitialized,
    getAudioContext, 
    preEQAnalyserNode: nodesRef.current.preEQAnalyserNode, 
    postProcessingAnalyserNode: nodesRef.current.postProcessingAnalyserNode, 
    getOfflineAudioContext,
    gainReductionDb,
    limiterGainReductionDb, 
    multibandGainReduction,
    loudnessMetrics, 
    resetLoudnessMeasurements 
  };
}
