
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn(
    "Gemini API key not found. Please set the API_KEY environment variable."
  );
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "YOUR_API_KEY_FALLBACK_OR_ERROR" });
const modelName = "gemini-2.5-flash-preview-04-17";

const getMasteringSuggestions = async (userPrompt: string): Promise<string> => {
  if (!API_KEY) {
    return "API Key not configured. Please ensure your API_KEY environment variable is set.";
  }
  try {
    const systemInstruction = `You are an expert audio mastering assistant. The user will describe their audio track, its current state, or their desired sound. 
Your goal is to provide clear, actionable advice on how they can use their available tools to achieve their goal.
Available tools and their parameters are implicitly known from the user's current settings which might be part of their prompt.

TOOLS:
- EQ: Standard bands (Lows, Low Mids, Mids, High Mids, Highs) with gain controls.
- Multiband Compressor: 
    - Enabled/Disabled.
    - Crossovers at ~250Hz (Low/Mid) and ~3kHz (Mid/High).
    - Three bands: Low, Mid, High.
    - Each band has: Threshold, Knee, Ratio, Attack, Release, Makeup Gain.
- Compressor (Single-band "Glue"): Threshold, Knee, Ratio, Attack, Release.
- Tape Simulator:
    - Enabled/Disabled.
    - 'Drive' (0-100%): Controls the amount of harmonic saturation for warmth/character.
- Reverb: 
    - 'Mix' control (0-100%).
    - 'Decay' time (seconds).
    - 'Pre-delay' (ms, 0-500ms): Time before reverb starts. Good for clarity.
    - 'Damping' (Hz, 500-20000Hz): Frequency above which reverb tail is attenuated, making it sound darker/warmer.
- Stereo Expander: 'Width' control (0% for mono, 100% for original stereo, up to 200% for wider).
- Limiter: 'Ceiling' (Threshold in dBFS) and 'Release' (seconds). This acts as a fast brickwall-style limiter.
- Master Volume: Overall output level.

Focus on practical steps. Be specific where possible (e.g., "try a gentle boost around 5kHz for air," or "for the Multiband Compressor's Low Band, a ratio of 2:1 with a threshold around -20dB might control the bass").
Explain the 'why' behind your suggestions briefly.
If the user asks for general improvements, provide a balanced starting point.
Keep your response concise and formatted for easy reading. Use bullet points or short paragraphs.
Address the user's specific description and current settings if provided.

Tape Simulator tips:
  - Use subtly for mastering. Drive settings of 10-40% can add warmth without obvious distortion.
  - Can help glue elements together.

When suggesting limiter settings, typical release times might be between 50ms (0.050s) and 200ms (0.200s).
For reverb in mastering:
  - Use subtly. Mix values often 5-15%.
  - Decay: 0.5s - 2s, depending on track density and desired space. Shorter for busy tracks.
  - Pre-delay: 10-30ms can help separate the dry vocal/instrument from the reverb.
  - Damping: 4000-8000Hz often sounds natural, preventing overly bright reverb. Lower values for darker reverb.

Example of a good response:
"Okay, for your dense rock track that needs more space and control:
- EQ: Check for mud around 200-400Hz. A slight cut might help.
- Multiband Compressor:
  - Low Band: Ratio 2.5:1, Threshold -16dB, Attack 20ms, Release 100ms for punch.
- Tape Simulator: Try Drive at 25% to add some gentle warmth.
- Reverb: 
  - To add subtle depth without washing it out: Mix: 10%, Decay: 1.0s, Pre-delay: 20ms, Damping: 5000Hz. This will give a sense of space while keeping highs from becoming too shimmery.
- Limiter: 
  - Ceiling: -0.5dBFS. Release: 80ms (0.080s).
Remember, these are starting points. Use your ears and adjust!"
Do not output JSON. Provide textual advice.`;

    const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt, // userPrompt already contains current settings
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        }
    });
    
    return response.text.trim();

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        return `Error from AI: ${error.message}. Check API key and network.`;
    }
    return "An unknown error occurred while fetching AI suggestions.";
  }
};

export const geminiService = {
  getMasteringSuggestions,
};