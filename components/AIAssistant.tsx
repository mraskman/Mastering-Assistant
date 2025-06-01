
import React, { useState, useRef, useEffect } from 'react';
import { Message, AudioProcessingParams } from '../types';
import { geminiService } from '../services/geminiService';
import { SparklesIcon, SendIcon, BotIcon, UserIcon, Loader2Icon } from '../assets/icons';

interface AIAssistantProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingAI: boolean;
  setIsLoadingAI: React.Dispatch<React.SetStateAction<boolean>>;
  processingParams: AudioProcessingParams;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ messages, setMessages, isLoadingAI, setIsLoadingAI, processingParams }) => {
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!userInput.trim() || isLoadingAI) return;

    const newUserMessage: Message = { id: Date.now().toString(), role: 'user', text: userInput, timestamp: new Date() };
    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoadingAI(true);

    try {
      const currentParamsInfo = `
        Current EQ settings: ${processingParams.eqBands.map(b => `${b.label}: ${b.gain.toFixed(1)}dB`).join(', ')}.
        Compressor: Threshold ${processingParams.compressor.threshold.toFixed(1)}dB, Ratio ${processingParams.compressor.ratio.toFixed(1)}:1, Attack ${processingParams.compressor.attack.toFixed(3)}s, Release ${processingParams.compressor.release.toFixed(3)}s.
        Reverb: Mix ${(processingParams.reverb.mix * 100).toFixed(0)}%, Decay ${processingParams.reverb.decay.toFixed(1)}s.
        Stereo Expander: Width ${(processingParams.stereoExpander.width * 100).toFixed(0)}%.
        Limiter Ceiling: ${processingParams.limiter.threshold.toFixed(1)}dB.
        Master Volume: ${(processingParams.masterVolume * 100).toFixed(0)}%.
      `;
      
      const fullPrompt = `User description: "${userInput}".\n${currentParamsInfo}`;
      const aiResponseText = await geminiService.getMasteringSuggestions(fullPrompt);
      
      const newAIMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: aiResponseText, timestamp: new Date() };
      setMessages(prev => [...prev, newAIMessage]);
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'error', text: 'Sorry, I encountered an error. Please try again. Check if your API key is configured.', timestamp: new Date() };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingAI(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-auto md:max-h-[calc(100vh-10rem)] bg-slate-700 rounded-lg">
      <h3 className="text-lg font-semibold text-slate-200 p-4 border-b border-slate-600 flex items-center">
        <SparklesIcon className="w-5 h-5 mr-2 text-sky-400"/> AI Mastering Guide
      </h3>
      <div className="flex-grow p-4 space-y-4 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-xl shadow ${
                msg.role === 'user' ? 'bg-sky-500 text-white rounded-br-none' : 
                msg.role === 'assistant' ? 'bg-slate-600 text-slate-200 rounded-bl-none' :
                msg.role === 'system' ? 'bg-slate-800 text-slate-300 text-sm italic rounded-md' :
                'bg-red-500 text-white rounded-bl-none'
            }`}>
              <div className="flex items-start space-x-2">
                {msg.role === 'assistant' && <BotIcon className="w-5 h-5 text-sky-300 flex-shrink-0 mt-0.5"/>}
                {msg.role === 'user' && <UserIcon className="w-5 h-5 text-sky-100 flex-shrink-0 mt-0.5"/>}
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
              <p className="text-xs opacity-60 mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-600">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Describe your track or goal..."
            className="flex-grow p-3 bg-slate-600 text-slate-100 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none placeholder-slate-400"
            disabled={isLoadingAI}
            aria-label="User input for AI assistant"
          />
          <button
            type="submit"
            disabled={isLoadingAI || !userInput.trim()}
            className="p-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center w-12 h-12"
            aria-label="Send message to AI assistant"
          >
            {isLoadingAI ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
};