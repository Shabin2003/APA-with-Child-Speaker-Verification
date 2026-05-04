import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Mic, XCircle, Loader2 } from 'lucide-react';
import { useSmartSpeech } from '../hooks/useSmartSpeech';
import { playCoin, playEncourage } from '../lib/sounds';

interface FruitItem {
  name: string;
  image: string;
  accent: string;
  aliases?: string[];
}

const FRUITS: FruitItem[] = [
  { name: 'apple',      image: '🍎', accent: 'from-red-100 to-rose-200' },
  { name: 'banana',     image: '🍌', accent: 'from-yellow-100 to-amber-200' },
  { name: 'orange',     image: '🍊', accent: 'from-orange-100 to-orange-200' },
  { name: 'grapes',     image: '🍇', accent: 'from-violet-100 to-purple-200', aliases: ['grape'] },
  { name: 'mango',      image: '🥭', accent: 'from-amber-100 to-orange-200' },
  { name: 'pineapple',  image: '🍍', accent: 'from-lime-100 to-yellow-200', aliases: ['pine apple'] },
  { name: 'strawberry', image: '🍓', accent: 'from-pink-100 to-rose-200' },
  { name: 'watermelon', image: '🍉', accent: 'from-emerald-100 to-lime-200', aliases: ['water melon'] },
  { name: 'pear',       image: '🍐', accent: 'from-lime-100 to-green-200' },
  { name: 'peach',      image: '🍑', accent: 'from-orange-100 to-pink-200' },
  { name: 'cherry',     image: '🍒', accent: 'from-rose-100 to-red-200', aliases: ['cherries'] },
  { name: 'lemon',      image: '🍋', accent: 'from-yellow-100 to-lime-200' },
  { name: 'coconut',    image: '🥥', accent: 'from-stone-100 to-amber-200' },
  { name: 'kiwi',       image: '🥝', accent: 'from-green-100 to-lime-200' },
  { name: 'blueberry',  image: '🫐', accent: 'from-blue-100 to-indigo-200', aliases: ['blueberries'] },
  { name: 'melon',      image: '🍈', accent: 'from-emerald-100 to-teal-200' },
];

const normalize = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');
const randomIdx = (exclude?: number) => {
  let i = Math.floor(Math.random() * FRUITS.length);
  while (FRUITS.length > 1 && i === exclude) i = Math.floor(Math.random() * FRUITS.length);
  return i;
};

export const FruitsNaming = () => {
  const [fruitIdx, setFruitIdx]   = useState(() => randomIdx());
  const [result, setResult]       = useState<{ correct: boolean; heard: string; expected: string } | null>(null);

  const asr = useSmartSpeech(4000);
  const fruit = FRUITS[fruitIdx];

  // When transcript arrives, auto-assess
  useEffect(() => {
    if (!asr.transcript || asr.isRecording || asr.isTranscribing || result) return;

    const heard = asr.transcript.trim();
    const normHeard = normalize(heard);
    const accepted = [fruit.name, ...(fruit.aliases ?? [])].map(normalize);
    const correct = accepted.some(a => normHeard.includes(a));
    setResult({ correct, heard, expected: fruit.name });

    correct ? playCoin() : playEncourage();
  }, [asr.transcript, asr.isRecording, asr.isTranscribing, result, fruit]);

  const handleNext = () => {
    asr.reset();
    setResult(null);
    setFruitIdx(i => randomIdx(i));
  };

  const handleRetry = () => {
    asr.reset();
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Mic className="w-8 h-8 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-800">Fruit Naming</h2>
          <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">
            {asr.engine === "browser" ? "Browser Speech" : "Wav2Vec2 ASR"}
          </span>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-gray-700">
          Look at the fruit and tap <strong>Speak Answer</strong>. Recording stops after 4 seconds and your answer is scored by the AI backend.
        </div>

        <div className={`bg-gradient-to-br ${fruit.accent} rounded-2xl p-5 mb-5 border border-white/60 shadow-sm text-center`}>
          <p className="text-sm font-medium text-gray-600 mb-3">Identify This Fruit</p>
          <div className="text-7xl mb-3">{fruit.image}</div>
          <p className="text-sm text-gray-700">Say the fruit name clearly in English.</p>
        </div>

        {!result && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={asr.isRecording ? asr.stop : asr.start}
              disabled={asr.isTranscribing}
              className={`px-8 py-4 rounded-full font-semibold text-lg shadow-md transition-all ${
                asr.isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
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
              <div className="flex gap-1 items-center">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 bg-orange-400 rounded-full"
                    style={{ height: `${8 + Math.random() * 16}px`, animation: `pulse ${0.3 + i * 0.1}s ease infinite alternate` }} />
                ))}
                <span className="ml-2 text-sm text-gray-500">Recording for 4s...</span>
              </div>
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
                  <p className="text-sm text-gray-600 mt-1">Expected: <strong>{result.expected}</strong></p>
                )}
                <div className="flex gap-3 mt-4">
                  {!result.correct && (
                    <button onClick={handleRetry} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium text-sm">
                      Try Again
                    </button>
                  )}
                  <button onClick={handleNext} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm">
                    Next Fruit →
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
