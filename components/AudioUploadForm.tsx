
import React, { ChangeEvent, DragEvent, useState } from 'react';
import { UploadCloudIcon } from '../assets/icons';

interface AudioUploadFormProps {
  onFileChange: (file: File | null) => void;
}

export const AudioUploadForm: React.FC<AudioUploadFormProps> = ({ onFileChange }) => {
  const [dragging, setDragging] = useState(false);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onFileChange(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0] || null;
    onFileChange(file);
  };

  return (
    <div className="mb-6">
      <label htmlFor="audio-upload" className="block text-sm font-medium text-slate-300 mb-2">
        Upload Audio Track
      </label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragging ? 'border-sky-500 bg-slate-600' : 'border-slate-500'} border-dashed rounded-md transition-colors duration-150`}
      >
        <div className="space-y-1 text-center">
          <UploadCloudIcon className={`mx-auto h-12 w-12 ${dragging ? 'text-sky-400' : 'text-slate-400'} transition-colors duration-150`} />
          <div className="flex text-sm text-slate-400">
            <label
              htmlFor="audio-file-input"
              className="relative cursor-pointer bg-slate-700 rounded-md font-medium text-sky-400 hover:text-sky-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-800 focus-within:ring-sky-500"
            >
              <span>Upload a file</span>
              <input id="audio-file-input" name="audio-file-input" type="file" className="sr-only" onChange={handleFileSelect} accept="audio/*" />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-slate-500">MP3, WAV, OGG, FLAC, etc. up to 50MB</p>
        </div>
      </div>
    </div>
  );
};
    