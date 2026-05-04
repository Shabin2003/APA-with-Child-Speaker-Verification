import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Palette, XCircle, Loader2 } from 'lucide-react';
import { useSmartSpeech } from '../hooks/useSmartSpeech';
import { playCoin, playEncourage } from '../lib/sounds';

interface ColourItem {
  name: string;
  aliases?: string[];
  bgClass: string;
  ringClass: string;
  textClass: string;
}

const COLOURS: ColourItem[] = [
  { name: 'red',    bgClass: 'bg-red-500',    ringClass: 'ring-red-200',    textClass: 'text-red-700' },
  { name: 'blue',   bgClass: 'bg-blue-500',   ringClass: 'ring-blue-200',   textClass: 'text-blue-700' },
  { name: 'yellow', bgClass: 'bg-yellow-400', ringClass: 'ring-yellow-200', textClass: 'text-yellow-700' },
  { name: 'green',  bgClass: 'bg-green-500',  ringClass: 'ring-green-200',  textClass: 'text-green-700' },
  { name: 'orange', bgClass: 'bg-orange-500', ringClass: 'ring-orange-200', textClass: 'text-orange-700' },
  { name: 'purple', bgClass: 'bg-purple-500', ringClass: 'ring-purple-200', textClass: 'text-purple-700' },
  { name: 'pink',   bgClass: 'bg-pink-400',   ringClass: 'ring-pink-200',   textClass: 'text-pink-700' },
  { name: 'brown',  bgClass: 'bg-amber-700',  ringClass: 'ring-amber-200',  textClass: 'text-amber-800' },
  { name: 'black',  bgClass: 'bg-black',      ringClass: 'ring-gray-300',   textClass: 'text-gray-800' },
  { name: 'white',  bgClass: 'bg-white',      ringClass: 'ring-gray-300',   textClass: 'text-gray-600', aliases: ['offwhite'] },
  { name: 'grey',   bgClass: 'bg-gray-400',   ringClass: 'ring-gray-300',   textClass: 'text-gray-700', aliases: ['gray'] },
];

const normalize = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');
const randomIdx = (exclude?: number) => {
  let i = Math.floor(Math.random() * COLOURS.length);
  while (COLOURS.length > 1 && i === exclude) i = Math.floor(Math.random() * COLOURS.length);
  return i;
};

export const ColoursMatching = () => {
  const [colourIdx, setColourIdx] = useState(() => randomIdx());
  const [result, setResult]       = useState<{ correct: boolean; heard: string; expected: string } | null>(null);

  const asr = useSmartSpeech(4000);
  const colour = COLOURS[colourIdx];

  useEffect(() => {
    if (!asr.transcript || asr.isRecording || asr.isTranscribing || result) return;

    const heard = asr.transcript.trim();
    const normHeard = normalize(heard);
    const accepted = [colour.name, ...(colour.aliases ?? [])].map(normalize);
    const correct = accepted.some(a => normHeard.includes(a));
    setResult({ correct, heard, expected: colour.name });

    correct ? playCoin() : playEncourage();
  }, [asr.transcript, asr.isRecording, asr.isTranscribing, result, colour]);

  const handleNext = () => {
    asr.reset();
    setResult(null);
    setColourIdx(i => randomIdx(i));
  };

  const handleRetry = () => {
    asr.reset();
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-8 h-8 text-sky-500" />
          <h2 className="text-2xl font-bold text-gray-800">Colours Matching</h2>
          <span className="ml-auto text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full font-semibold">
            {asr.engine === "browser" ? "Browser Speech" : "Wav2Vec2 ASR"}
          </span>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4 text-sm text-gray-700">
          Look at the colour and tap <strong>Speak Answer</strong>. Recording stops after 4 seconds and your answer is scored by the AI backend.
        </div>

        <div className="rounded-2xl p-5 mb-5 border border-white/60 shadow-sm bg-gradient-to-br from-slate-50 to-sky-50 text-center">
          <p className="text-sm font-medium text-gray-600 mb-3">Identify This Colour</p>
          <div className="flex justify-center mb-3">
            <div className={`w-40 h-40 rounded-full shadow-inner ring-8 ${colour.bgClass} ${colour.ringClass}`} />
          </div>
          <p className="text-sm text-gray-700">Say the colour name clearly in English.</p>
        </div>

        {!result && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={asr.isRecording ? asr.stop : asr.start}
              disabled={asr.isTranscribing}
              className={`px-8 py-4 rounded-full font-semibold text-lg shadow-md transition-all ${
                asr.isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-sky-500 hover:bg-sky-600 text-white'
              } disabled:opacity-50`}
            >
              {asr.isRecording ? '🔴 Listening... (tap to stop)' : '🎤 Speak Answer'}
            </button>

            {asr.isTranscribing && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                {asr.engine === "browser" ? "Processing..." : "Analyzing with Wav2Vec2..."}
              </div>
            )}

            {asr.isRecording && (
              <span className="text-sm text-gray-500 animate-pulse">Recording for 4s...</span>
            )}
          </div>
        )}

        {result && (
          <div className={`mt-4 rounded-xl border p-5 ${result.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              {result.correct
                ? <CheckCircle className="w-7 h-7 text-green-600 shrink-0" />
                : <XCircle className="w-7 h-7 text-red-600 shrink-0" />}
              <div>
                <h3 className={`text-xl font-semibold ${result.correct ? 'text-green-800' : 'text-red-800'}`}>
                  {result.correct ? '✅ Correct!' : '❌ Not quite!'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">You said: <strong>"{result.heard}"</strong></p>
                {!result.correct && (
                  <p className={`text-sm font-medium mt-1 ${colour.textClass}`}>Expected: <strong>{result.expected}</strong></p>
                )}
                <div className="flex gap-3 mt-4">
                  {!result.correct && (
                    <button onClick={handleRetry} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium text-sm">
                      Try Again
                    </button>
                  )}
                  <button onClick={handleNext} className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium text-sm">
                    Next Colour →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {asr.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{asr.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
