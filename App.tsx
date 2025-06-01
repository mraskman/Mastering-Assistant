
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EQBand, CompressorParams, LimiterParams, AudioProcessingParams, Message, ReverbParams, StereoExpanderParams, LoudnessMetrics, MultibandCompressorParams, TapeSimulatorParams, VisualizerSettings } from './types';
import { AudioUploadForm } from './components/AudioUploadForm';
import { AudioControls } from './components/AudioControls';
import { AIAssistant } from './components/AIAssistant';
import { useAudioProcessor, createSyntheticImpulseResponse } from './hooks/useAudioProcessor'; 
import { InfoIcon, MusicIcon, DownloadIcon, Loader2Icon, RefreshCwIcon, BarChartIcon } from './assets/icons';
import { audioBufferToWAV } from './utils/audioBufferToWAV'; 

const initialEQBands: EQBand[] = [
  { id: 'lowShelf', frequency: 80, gain: 0, type: 'lowshelf', label: 'Lows (80Hz)' },
  { id: 'lowMid', frequency: 250, gain: 0, type: 'peaking', q: 1.2, label: 'Low Mids (250Hz)' },
  { id: 'mid', frequency: 1000, gain: 0, type: 'peaking', q: 1.2, label: 'Mids (1kHz)' },
  { id: 'highMid', frequency: 4000, gain: 0, type: 'peaking', q: 1.2, label: 'High Mids (4kHz)' },
  { id: 'highShelf', frequency: 6000, gain: 0, type: 'highshelf', label: 'Highs (6kHz)' },
];

const initialCompressorParams: CompressorParams = {
  threshold: -24, knee: 30, ratio: 4, attack: 0.003, release: 0.25,
};

const initialMultibandCompressorParams: MultibandCompressorParams = {
  enabled: true,
  crossoverLowMid: 250,
  crossoverMidHigh: 3000,
  lowBand: { threshold: -18, knee: 30, ratio: 3, attack: 0.01, release: 0.15, makeupGain: 0 },
  midBand: { threshold: -18, knee: 30, ratio: 3, attack: 0.005, release: 0.1, makeupGain: 0 },
  highBand: { threshold: -18, knee: 30, ratio: 3, attack: 0.002, release: 0.05, makeupGain: 0 },
};

const initialTapeSimulatorParams: TapeSimulatorParams = {
  enabled: false,
  drive: 0.1, 
};

const initialLimiterParams: LimiterParams = {
  threshold: -1, 
  release: 0.050, 
};

const initialReverbParams: ReverbParams = {
  mix: 0, 
  decay: 1.5, 
  preDelay: 0.02, 
  damping: 6000, 
};

const initialStereoExpanderParams: StereoExpanderParams = {
  width: 1, 
};

const initialVisualizerSettings: VisualizerSettings = {
  mode: 'post-processing',
  peakHoldEnabled: false,
};


const App: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSrcForDisplay, setAudioSrcForDisplay] = useState<string | null>(null); 
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentBlobUrlRef = useRef<string | null>(null); 
  const [originalAudioBuffer, setOriginalAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [audioElementKey, setAudioElementKey] = useState<number>(0); // Key to force re-mount

  const [processingParams, setProcessingParams] = useState<AudioProcessingParams>({
    eqBands: initialEQBands,
    compressor: initialCompressorParams,
    multibandCompressor: initialMultibandCompressorParams,
    tapeSimulator: initialTapeSimulatorParams,
    limiter: initialLimiterParams,
    reverb: initialReverbParams,
    stereoExpander: initialStereoExpanderParams,
    masterVolume: 1,
  });

  const [visualizerSettings, setVisualizerSettings] = useState<VisualizerSettings>(initialVisualizerSettings);
  const [peakHoldResetKey, setPeakHoldResetKey] = useState<number>(0);


  const { 
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
    preEQAnalyserNode,
    postProcessingAnalyserNode,
    getOfflineAudioContext,
    gainReductionDb,
    limiterGainReductionDb, 
    multibandGainReduction, 
    loudnessMetrics, 
    resetLoudnessMeasurements 
  } = useAudioProcessor(audioRef);
  
  const [messages, setMessages] = useState<Message[]>([
    { id: 'initial-greeting', role: 'system', text: "Welcome to the AI Audio Mastering Assistant! Describe your track or what you'd like to achieve, and I'll provide suggestions.", timestamp: new Date() }
  ]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const handleFileChange = useCallback(async (file: File | null) => {
    const currentAudioEl = audioRef.current;
    if (currentAudioEl) {
        currentAudioEl.pause();
    }

    if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
    }
    
    setAudioFile(file); 
    setAudioSrcForDisplay(null); 
    setOriginalAudioBuffer(null); 
    resetLoudnessMeasurements(); 
    setPeakHoldResetKey(prev => prev + 1);
    setAudioElementKey(prevKey => prevKey + 1); 

    if (file) {
      const newUrl = URL.createObjectURL(file);
      currentBlobUrlRef.current = newUrl;
      setAudioSrcForDisplay(newUrl); 

      try {
        const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const decodedBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
        setOriginalAudioBuffer(decodedBuffer); 
        await tempAudioContext.close(); 
      } catch (error) {
        console.error("Error decoding audio file in handleFileChange:", error instanceof Error ? error.message : String(error));
        setMessages(prev => [...prev, {id: Date.now().toString(), role: 'error', text: `Error decoding audio file: ${file.name}. Please try a different file or format. Details: ${error instanceof Error ? error.message : String(error)}`, timestamp: new Date()}]);
        setAudioFile(null); 
        setAudioSrcForDisplay(null);
        if (currentBlobUrlRef.current) { 
            URL.revokeObjectURL(currentBlobUrlRef.current);
            currentBlobUrlRef.current = null;
        }
      }
    }
  }, [resetLoudnessMeasurements]); 

  useEffect(() => {
    const blobUrl = currentBlobUrlRef.current;
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        currentBlobUrlRef.current = null;
      }
    };
  }, [audioElementKey]); 

  useEffect(() => {
    const currentAudioEl = audioRef.current;
    const initAudioAsync = async () => {
        if (originalAudioBuffer && currentAudioEl && audioFile && audioSrcForDisplay && currentAudioEl.src === audioSrcForDisplay) {
            await initializeAudio(processingParams); 
                
            const audioCtxInstance = getAudioContext();
            if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
                audioCtxInstance.resume().catch(e => console.error("App.tsx useEffect: Error resuming AudioContext:", e instanceof Error ? e.message : String(e)));
            }
        }
    };
    
    initAudioAsync().catch(e => console.error("Error during async audio initialization in App.tsx useEffect:", e instanceof Error ? e.message : String(e)));

  }, [originalAudioBuffer, audioFile, audioSrcForDisplay, audioElementKey, initializeAudio, getAudioContext]);


  useEffect(() => {
    if (isAudioContextInitialized()) {
      updateEQ(processingParams.eqBands);
      updateCompressor(processingParams.compressor);
      updateMultibandCompressor(processingParams.multibandCompressor);
      updateTapeSimulator(processingParams.tapeSimulator);
      updateLimiter(processingParams.limiter);
      updateReverb(processingParams.reverb);
      updateStereoExpander(processingParams.stereoExpander);
      updateMasterVolume(processingParams.masterVolume);
    }
  }, [processingParams, updateEQ, updateCompressor, updateMultibandCompressor, updateTapeSimulator, updateLimiter, updateReverb, updateStereoExpander, updateMasterVolume, isAudioContextInitialized]);
  
  const handlePlay = async () => {
    const currentAudioEl = audioRef.current;
    if (!currentAudioEl) return;

    if (!isAudioContextInitialized() && originalAudioBuffer) { 
        await initializeAudio(processingParams);
    }
    
    const audioCtx = getAudioContext(); 
    if (audioCtx && audioCtx.state === 'suspended') {
        try {
            await audioCtx.resume();
        } catch (e) {
            console.error("Error resuming AudioContext in handlePlay:", e instanceof Error ? e.message : String(e));
            setMessages(prev => [...prev, {id: Date.now().toString(), role: 'error', text: `Could not resume audio playback. Please try interacting with the page or reloading. Error: ${e instanceof Error ? e.message : String(e)}`, timestamp: new Date()}]);
            return;
        }
    }

    if (currentAudioEl.src && currentAudioEl.src !== window.location.href && currentAudioEl.src !== "") {
        try {
            if (currentAudioEl.currentTime < 0.1) { 
                 resetLoudnessMeasurements();
                 setPeakHoldResetKey(prev => prev + 1);
            }
            await currentAudioEl.play();
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.info("Playback attempt was interrupted. This is often normal. Message:", error.message);
            } else {
                console.error("Error during playback attempt:", error.name, error.message);
                setMessages(prev => [...prev, {id: Date.now().toString(), role: 'error', text: `Failed to play audio: ${error.message}`, timestamp: new Date()}]);
            }
        }
    } else {
        setMessages(prev => [...prev, {id: Date.now().toString(), role: 'system', text: "No audio loaded to play. Please upload a file.", timestamp: new Date()}]);
    }
  };

  const handlePause = () => {
    audioRef.current?.pause();
  };

  const onParamsChange = <K extends keyof AudioProcessingParams>(
    paramType: K,
    value: AudioProcessingParams[K]
  ) => {
    setProcessingParams(prev => ({ ...prev, [paramType]: value }));
  };
  
  const onSpecificEQBandChange = (bandId: string, gainValue: number) => {
    setProcessingParams(prev => ({
      ...prev,
      eqBands: prev.eqBands.map(band =>
        band.id === bandId ? { ...band, gain: gainValue } : band
      ),
    }));
  };

   const handleVisualizerSettingsChange = (newSettings: Partial<VisualizerSettings>) => {
    setVisualizerSettings(prev => ({ ...prev, ...newSettings }));
    if (newSettings.mode) { 
      setPeakHoldResetKey(prev => prev + 1);
    }
  };

  const handleResetPeaks = () => {
    setPeakHoldResetKey(prev => prev + 1);
  };


  const handleDownload = async () => {
    if (!originalAudioBuffer || isDownloading) return;

    setIsDownloading(true);
    try {
      const targetSampleRate = 48000;
      const offlineAudioObjects = getOfflineAudioContext ? getOfflineAudioContext(originalAudioBuffer, targetSampleRate, processingParams) : null;

      let renderedBuffer: AudioBuffer;

      if (!offlineAudioObjects || !offlineAudioObjects.context || !offlineAudioObjects.inputNode) {
        console.warn("Offline context setup via useAudioProcessor failed or incomplete, attempting manual chain creation for download.");
        
        const fallbackOfflineCtx = new OfflineAudioContext(originalAudioBuffer.numberOfChannels, Math.ceil(originalAudioBuffer.duration * targetSampleRate), targetSampleRate);
        
        const source = fallbackOfflineCtx.createBufferSource();
        source.buffer = originalAudioBuffer;
        let currentOfflineNode: AudioNode = source;

        // EQ
        const offlineEqNodes = processingParams.eqBands.map(band => {
          const filter = fallbackOfflineCtx.createBiquadFilter();
          filter.type = band.type;
          filter.frequency.value = band.frequency;
          filter.gain.value = band.gain;
          if (band.q) filter.Q.value = band.q;
          return filter;
        });
        offlineEqNodes.forEach(eqNode => { currentOfflineNode.connect(eqNode); currentOfflineNode = eqNode; });

        // Multiband Compressor (Simplified for fallback)
        const mbParams = processingParams.multibandCompressor;
        if (mbParams.enabled && originalAudioBuffer.numberOfChannels === 2) {
            const inputGain = fallbackOfflineCtx.createGain();
            currentOfflineNode.connect(inputGain);

            const lowPass = fallbackOfflineCtx.createBiquadFilter();
            lowPass.type = 'lowpass';
            lowPass.frequency.value = mbParams.crossoverLowMid;
            lowPass.Q.value = 0.7071;

            const midBandHighPass = fallbackOfflineCtx.createBiquadFilter();
            midBandHighPass.type = 'highpass';
            midBandHighPass.frequency.value = mbParams.crossoverLowMid;
            midBandHighPass.Q.value = 0.7071;

            const midBandLowPass = fallbackOfflineCtx.createBiquadFilter();
            midBandLowPass.type = 'lowpass';
            midBandLowPass.frequency.value = mbParams.crossoverMidHigh;
            midBandLowPass.Q.value = 0.7071;
            
            const highPass = fallbackOfflineCtx.createBiquadFilter();
            highPass.type = 'highpass';
            highPass.frequency.value = mbParams.crossoverMidHigh;
            highPass.Q.value = 0.7071;

            const merger = fallbackOfflineCtx.createGain(); 

            const lowComp = fallbackOfflineCtx.createDynamicsCompressor();
            lowComp.threshold.value = mbParams.lowBand.threshold; lowComp.knee.value = mbParams.lowBand.knee; lowComp.ratio.value = mbParams.lowBand.ratio; lowComp.attack.value = mbParams.lowBand.attack; lowComp.release.value = mbParams.lowBand.release;
            const lowMakeup = fallbackOfflineCtx.createGain(); lowMakeup.gain.value = Math.pow(10, mbParams.lowBand.makeupGain / 20);
            inputGain.connect(lowPass).connect(lowComp).connect(lowMakeup).connect(merger);

            const midComp = fallbackOfflineCtx.createDynamicsCompressor();
            midComp.threshold.value = mbParams.midBand.threshold; midComp.knee.value = mbParams.midBand.knee; midComp.ratio.value = mbParams.midBand.ratio; midComp.attack.value = mbParams.midBand.attack; midComp.release.value = mbParams.midBand.release;
            const midMakeup = fallbackOfflineCtx.createGain(); midMakeup.gain.value = Math.pow(10, mbParams.midBand.makeupGain / 20);
            inputGain.connect(midBandHighPass).connect(midBandLowPass).connect(midComp).connect(midMakeup).connect(merger);
            
            const highComp = fallbackOfflineCtx.createDynamicsCompressor();
            highComp.threshold.value = mbParams.highBand.threshold; highComp.knee.value = mbParams.highBand.knee; highComp.ratio.value = mbParams.highBand.ratio; highComp.attack.value = mbParams.highBand.attack; highComp.release.value = mbParams.highBand.release;
            const highMakeup = fallbackOfflineCtx.createGain(); highMakeup.gain.value = Math.pow(10, mbParams.highBand.makeupGain / 20);
            inputGain.connect(highPass).connect(highComp).connect(highMakeup).connect(merger);
            
            currentOfflineNode = merger;
        } else if (mbParams.enabled && originalAudioBuffer.numberOfChannels !== 2) {
            // If multiband is enabled but source is not stereo, we can't use this specific 3-band stereo setup.
            // For simplicity, we'll bypass multiband in this fallback for mono.
        }
      
        // Compressor
        const offlineCompressor = fallbackOfflineCtx.createDynamicsCompressor();
        offlineCompressor.threshold.value = processingParams.compressor.threshold;
        offlineCompressor.knee.value = processingParams.compressor.knee;
        offlineCompressor.ratio.value = processingParams.compressor.ratio;
        offlineCompressor.attack.value = processingParams.compressor.attack;
        offlineCompressor.release.value = processingParams.compressor.release;
        currentOfflineNode.connect(offlineCompressor); currentOfflineNode = offlineCompressor;

        // Tape Simulator (Fallback - adjusted)
        const tapeParams = processingParams.tapeSimulator;
        if (tapeParams.enabled) {
            const tapeInputGain = fallbackOfflineCtx.createGain();
            tapeInputGain.gain.value = 1 + tapeParams.drive * 0.25; 

            const waveShaper = fallbackOfflineCtx.createWaveShaper();
            const K_VALUE_FOR_CURVE = tapeParams.drive * 10; 
            const curve = new Float32Array(4096);
            const n_samples = 4096;
            for (let i = 0; i < n_samples; i++) {
                const x = (i * 2) / n_samples - 1; 
                curve[i] = (Math.PI + K_VALUE_FOR_CURVE) * x / (Math.PI + K_VALUE_FOR_CURVE * Math.abs(x));
            }
            waveShaper.curve = curve;
            waveShaper.oversample = '4x';

            const tapeOutputGain = fallbackOfflineCtx.createGain(); 
            tapeOutputGain.gain.value = 1 / (1 + tapeParams.drive * 0.05); 

            currentOfflineNode.connect(tapeInputGain);
            tapeInputGain.connect(waveShaper);
            waveShaper.connect(tapeOutputGain);
            currentOfflineNode = tapeOutputGain;
        }

        // Stereo Expander
        const { width: stereoWidth } = processingParams.stereoExpander;
        if (originalAudioBuffer.numberOfChannels === 2 && stereoWidth !== 1.0) { 
            const splitter = fallbackOfflineCtx.createChannelSplitter(2);
            const merger = fallbackOfflineCtx.createChannelMerger(2);
            
            const midGainL = fallbackOfflineCtx.createGain(); midGainL.gain.value = 0.5;
            const midGainR = fallbackOfflineCtx.createGain(); midGainR.gain.value = 0.5;
            const midChannel = fallbackOfflineCtx.createGain();

            const sideGainL = fallbackOfflineCtx.createGain(); sideGainL.gain.value = 0.5;
            const sideGainR = fallbackOfflineCtx.createGain(); sideGainR.gain.value = -0.5;
            const sideChannel = fallbackOfflineCtx.createGain();
            const sideProcessorGain = fallbackOfflineCtx.createGain(); sideProcessorGain.gain.value = stereoWidth;

            const outL = fallbackOfflineCtx.createGain();
            const outRInvert = fallbackOfflineCtx.createGain(); outRInvert.gain.value = -1;
            const outR = fallbackOfflineCtx.createGain();

            currentOfflineNode.connect(splitter);
            splitter.connect(midGainL, 0); splitter.connect(midGainR, 1);
            splitter.connect(sideGainL, 0); splitter.connect(sideGainR, 1);

            midGainL.connect(midChannel); midGainR.connect(midChannel);
            sideGainL.connect(sideChannel); sideGainR.connect(sideChannel);
            sideChannel.connect(sideProcessorGain);

            midChannel.connect(outL); sideProcessorGain.connect(outL);
            midChannel.connect(outR); sideProcessorGain.connect(outRInvert); outRInvert.connect(outR);
            
            outL.connect(merger, 0, 0); outR.connect(merger, 0, 1);
            currentOfflineNode = merger;
        } else if (originalAudioBuffer.numberOfChannels !== 2 && stereoWidth !== 1.0) {
             // If not stereo, but width is not 1 (neutral), it implies user wants mono-fication if width is 0.
            if (stereoWidth === 0 && currentOfflineNode.channelCount > 1) { // Check if node actually has more than 1 channel
                 // Simple mono summing if input has multiple channels
                const monoSumGain = fallbackOfflineCtx.createGain();
                monoSumGain.channelCountMode = 'explicit';
                monoSumGain.channelInterpretation = 'speakers'; // Important for correct summing to mono
                currentOfflineNode.connect(monoSumGain);
                currentOfflineNode = monoSumGain;
            }
        }
        
        // Reverb
        const { mix: reverbMix, decay: reverbDecay, preDelay: reverbPreDelay, damping: reverbDamping } = processingParams.reverb;
        if (reverbMix > 0) { 
            const dryGainOffline = fallbackOfflineCtx.createGain();
            dryGainOffline.gain.value = 1.0 - reverbMix;
            
            const preDelayNodeOffline = fallbackOfflineCtx.createDelay(Math.max(0.001, reverbPreDelay + 0.1)); 
            preDelayNodeOffline.delayTime.value = reverbPreDelay;

            const convolverOffline = fallbackOfflineCtx.createConvolver();
            const tempIrBuffer = createSyntheticImpulseResponse(fallbackOfflineCtx, reverbDecay, reverbDamping); 
            
            const irBufferForConvolver = fallbackOfflineCtx.createBuffer(
                originalAudioBuffer.numberOfChannels, 
                tempIrBuffer.length, 
                tempIrBuffer.sampleRate
            );

            for (let ch = 0; ch < originalAudioBuffer.numberOfChannels; ch++) {
                irBufferForConvolver.copyToChannel(tempIrBuffer.getChannelData(Math.min(ch, tempIrBuffer.numberOfChannels - 1)), ch);
            }
            convolverOffline.buffer = irBufferForConvolver;
            convolverOffline.normalize = true;


            const wetGainOffline = fallbackOfflineCtx.createGain();
            wetGainOffline.gain.value = reverbMix;
            
            const reverbInputNode = currentOfflineNode; 
            
            reverbInputNode.connect(dryGainOffline); 
            reverbInputNode.connect(preDelayNodeOffline); 
            preDelayNodeOffline.connect(convolverOffline); 
            convolverOffline.connect(wetGainOffline);

            const reverbSumOffline = fallbackOfflineCtx.createGain();
            dryGainOffline.connect(reverbSumOffline);
            wetGainOffline.connect(reverbSumOffline);
            currentOfflineNode = reverbSumOffline; 
        }
        
        // Limiter (Now after Reverb)
        const offlineLimiter = fallbackOfflineCtx.createDynamicsCompressor();
        offlineLimiter.threshold.value = processingParams.limiter.threshold;
        offlineLimiter.knee.value = 0; 
        offlineLimiter.ratio.value = 20; 
        offlineLimiter.attack.value = 0.001; 
        offlineLimiter.release.value = processingParams.limiter.release;
        currentOfflineNode.connect(offlineLimiter); currentOfflineNode = offlineLimiter;
      
        const offlineMasterGain = fallbackOfflineCtx.createGain();
        offlineMasterGain.gain.value = processingParams.masterVolume;
        currentOfflineNode.connect(offlineMasterGain); currentOfflineNode = offlineMasterGain;
        
        currentOfflineNode.connect(fallbackOfflineCtx.destination);
        source.start(0);
        renderedBuffer = await fallbackOfflineCtx.startRendering();

      } else {
        if (!(offlineAudioObjects.inputNode instanceof AudioBufferSourceNode)) {
          throw new Error("Offline context inputNode is not an AudioBufferSourceNode as expected.");
        }
        offlineAudioObjects.inputNode.start(0);
        renderedBuffer = await offlineAudioObjects.context.startRendering();
      }
      
      const wavBlob = audioBufferToWAV(renderedBuffer, 24); 

      const downloadUrl = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      const fileName = audioFile?.name.replace(/\.[^/.]+$/, "") || 'mastered_track';
      a.download = `${fileName}_${targetSampleRate/1000}kHz_24bit.wav`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

    } catch (error) {
      console.error("Error during audio download:", error);
      setMessages(prev => [...prev, {id: Date.now().toString(), role: 'error', text: `Failed to process and download audio. ${error instanceof Error ? error.message : ''}`, timestamp: new Date()}]);
    } finally {
      setIsDownloading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 flex flex-col items-center p-4 md:p-8 selection:bg-sky-500 selection:text-white">
      <header className="w-full max-w-5xl mb-8 text-center">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <MusicIcon className="w-10 h-10 text-sky-400" />
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
            AI Audio Mastering Assistant
          </h1>
        </div>
        <p className="text-slate-400 text-sm md:text-base">
          Upload your track, tweak the controls, and get AI-powered suggestions to make your music shine.
        </p>
        <div className="mt-3 text-xs text-slate-500 flex items-center justify-center space-x-1 bg-slate-700 p-2 rounded-md max-w-md mx-auto">
            <InfoIcon className="w-4 h-4 text-sky-500"/>
            <span>This app uses Web Audio API for effects. AI suggestions guide your adjustments.</span>
        </div>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-700 p-6 rounded-xl shadow-2xl">
          <AudioUploadForm onFileChange={handleFileChange} />
          {/* Apply key to force re-mount */}
          <audio ref={audioRef} key={audioElementKey} controls className="w-full mt-6" crossOrigin="anonymous" src={audioSrcForDisplay || undefined}>
            Your browser does not support the audio element.
          </audio>
          {audioSrcForDisplay && (
            <div className="mt-4 flex space-x-2 flex-wrap gap-2">
                <button 
                  onClick={handlePlay} 
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105"
                  aria-label="Play processed audio"
                >
                  Play Processed
                </button>
                <button 
                  onClick={handlePause} 
                  className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out"
                  aria-label="Pause audio"
                >
                  Pause
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!originalAudioBuffer || isDownloading}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  aria-label="Download processed audio as WAV"
                >
                  {isDownloading ? (
                    <>
                      <Loader2Icon className="w-5 h-5 mr-2 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="w-5 h-5 mr-2" /> Download WAV
                    </>
                  )}
                </button>
              </div>
          )}
          {audioFile && isAudioContextInitialized() ? (
             <AudioControls
                processingParams={processingParams}
                onParamsChange={onParamsChange}
                onSpecificEQBandChange={onSpecificEQBandChange}
                preEQAnalyserNode={preEQAnalyserNode}
                postProcessingAnalyserNode={postProcessingAnalyserNode}
                gainReductionDb={gainReductionDb} 
                limiterGainReductionDb={limiterGainReductionDb}
                multibandGainReduction={multibandGainReduction}
                loudnessMetrics={loudnessMetrics} 
                onResetLoudness={resetLoudnessMeasurements} 
                visualizerSettings={visualizerSettings}
                onVisualizerSettingsChange={handleVisualizerSettingsChange}
                onResetPeaks={handleResetPeaks}
                peakHoldResetKey={peakHoldResetKey}
             />
          ) : (
             <div className="mt-8 bg-slate-600 p-4 rounded-lg shadow-inner min-h-[160px] flex flex-col items-center justify-center text-center">
                <div className="flex items-center text-lg font-semibold text-slate-200 mb-3">
                    <BarChartIcon className="w-5 h-5 mr-2 text-sky-400" /> Audio Visualizer
                </div>
                <p className="text-slate-400 text-sm">Please upload an audio file to activate the visualizer.</p>
                <p className="text-xs text-slate-500 mt-4">Other audio controls will also appear once a file is loaded.</p>
            </div>
           )}
        </div>

        <div className="md:col-span-1 bg-slate-700 p-6 rounded-xl shadow-2xl">
          <AIAssistant
            messages={messages}
            setMessages={setMessages}
            isLoadingAI={isLoadingAI}
            setIsLoadingAI={setIsLoadingAI}
            processingParams={processingParams}
          />
        </div>
      </main>

      <footer className="w-full max-w-5xl mt-12 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} AI Audio Mastering Assistant. For demonstration purposes.</p>
        <p className="mt-1">Remember to use high-quality source audio for best results. Output is 48kHz, 24-bit WAV.</p>
        <p className="mt-1">Loudness measurements are approximate and for guidance only.</p>
      </footer>
    </div>
  );
};

export default App;
