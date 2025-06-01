
import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyserNode: AnalyserNode;
  peakHoldEnabled?: boolean;
  peakHoldResetKey?: number; // A key that changes to trigger reset
}

export const Visualizer: React.FC<VisualizerProps> = ({ 
    analyserNode, 
    peakHoldEnabled = false,
    peakHoldResetKey = 0 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakHoldDataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    // Reset peak hold data when analyserNode changes or peakHoldResetKey changes
    if (analyserNode) {
        peakHoldDataRef.current = new Uint8Array(analyserNode.frequencyBinCount);
        peakHoldDataRef.current.fill(0);
    }
  }, [analyserNode, peakHoldResetKey]);


  useEffect(() => {
    if (!canvasRef.current || !analyserNode) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    if (!peakHoldDataRef.current || peakHoldDataRef.current.length !== bufferLength) {
        peakHoldDataRef.current = new Uint8Array(bufferLength);
        peakHoldDataRef.current.fill(0);
    }
    const peakData = peakHoldDataRef.current;


    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = 'rgb(30, 41, 59)'; // bg-slate-800
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let peakBarHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] * (canvas.height / 256.0) * 0.8; 

        if (peakHoldEnabled && peakData) {
            if (dataArray[i] > peakData[i]) {
                peakData[i] = dataArray[i];
            }
            peakBarHeight = peakData[i] * (canvas.height / 256.0) * 0.8;
            
            // Draw peak hold line
            canvasCtx.fillStyle = 'rgba(107, 114, 128, 0.7)'; // slate-500 with opacity
            canvasCtx.fillRect(x, canvas.height - peakBarHeight -1, barWidth, 2); // 2px thick line
        }


        // Gradient color for main bars
        const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, 'rgb(56, 189, 248)'); // sky-400
        gradient.addColorStop(0.5, 'rgb(34, 211, 238)'); // cyan-400
        gradient.addColorStop(1, 'rgb(14, 116, 144)'); // cyan-700
        
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyserNode, peakHoldEnabled, peakHoldResetKey]); // peakHoldResetKey in dependencies

  return <canvas ref={canvasRef} width="600" height="120" className="w-full rounded-md"></canvas>;
};
