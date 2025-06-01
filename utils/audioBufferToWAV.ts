
// Function to write a string to a DataView
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function audioBufferToWAV(buffer: AudioBuffer, bitDepth: 16 | 24 = 24): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length; // Total number of samples per channel

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample; // Bytes per sample frame (all channels)
  const byteRate = sampleRate * blockAlign; // Bytes per second
  const dataSize = numSamples * blockAlign; // Total size of PCM data in bytes

  const wavHeaderSize = 44;
  const totalBufferSize = wavHeaderSize + dataSize;
  const wavInternalBuffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(wavInternalBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize (Total size - 8 bytes for RIFF signature and ChunkSize)
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size (data size)

  // Write PCM data
  // Interleave channels
  let pcmOffset = wavHeaderSize;
  for (let i = 0; i < numSamples; i++) { // Iterate over samples
    for (let channel = 0; channel < numChannels; channel++) { // Iterate over channels
      const sample = buffer.getChannelData(channel)[i];
      
      // Clamp sample to [-1, 1]
      const clampedSample = Math.max(-1, Math.min(1, sample));

      if (bitDepth === 24) {
        // Scale to 24-bit integer range. (2^23 - 1 for positive max)
        // 8388607 is 2^23 - 1. Max positive value. Min negative is -2^23.
        const val = Math.round(clampedSample * 8388607);
        view.setInt8(pcmOffset++, val & 0xFF);        // LSB
        view.setInt8(pcmOffset++, (val >> 8) & 0xFF);
        view.setInt8(pcmOffset++, (val >> 16) & 0xFF); // MSB
      } else { // 16-bit
        const val = Math.round(clampedSample * 32767); // 0x7FFF
        view.setInt16(pcmOffset, val, true); // Little-endian
        pcmOffset += 2;
      }
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}
