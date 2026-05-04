import { useState, useEffect, useRef } from 'react';
import { BookOpen, TrendingUp, AlertCircle, Volume2, Video, RefreshCw, Sparkles, Info, Lightbulb } from 'lucide-react';
import { playForAccuracy } from '../lib/sounds';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useVideoRecorder } from '../hooks/useVideoRecorder';
import { analyzePronunciation, analyzePronunciationAndVerify, generateText, getSentencePool } from '../lib/api';
import type { GenerateTextResponse, PronunciationAndVerifyResponse } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AudioVisualizer } from './AudioVisualizer';
import { RecordingControls } from './RecordingControls';
import { VideoPreview } from './VideoPreview';
import { Tooltip } from './Tooltip';
import { GuideBox } from './GuideBox';

// ── Static fallback pool — grows at runtime from MongoDB ─────────────────────
// These are used when the FastAPI server is down.
const STATIC_FALLBACK: Record<string, GenerateTextResponse[]> = {
  Easy: [
    { sentence: 'The cat sits on the mat.', fact: 'Cats sleep up to 16 hours a day.', tip: "Stress 'cat' and 'mat' clearly." },
    { sentence: 'Birds fly in the sky.', fact: 'Birds have hollow bones to help them fly.', tip: "Pronounce 'fly' with a long 'i' sound." },
    { sentence: 'The sun gives us light.', fact: 'The sun is a giant ball of hot gas.', tip: "Stress 'sun' and 'light'." },
  ],
  Medium: [
    { sentence: 'The Amazon River flows through Brazil.', fact: 'The Amazon is the largest river by volume.', tip: "Say 'Am-a-zon' with stress on first syllable." },
    { sentence: 'The children played happily in the park.', fact: 'Playing outside boosts creativity.', tip: "Stress 'hap-pi-ly' — three syllables." },
    { sentence: 'She reads interesting books every night.', fact: 'Reading improves vocabulary and memory.', tip: "Pronounce 'in-ter-est-ing' clearly." },
  ],
  Hard: [
    { sentence: 'Scientists discovered extraordinary phenomena in the deep ocean.', fact: 'Over 80% of the ocean remains unexplored.', tip: "Break 'ex-tra-or-di-na-ry' into five parts." },
    { sentence: 'Technology has dramatically transformed global communication networks.', fact: 'The internet connects over 5 billion people.', tip: "Stress 'trans-FORMED' and 'com-mu-ni-CA-tion'." },
  ],
};

// Runtime pool — starts from STATIC_FALLBACK, grows from MongoDB
let runtimePool: Record<string, GenerateTextResponse[]> = JSON.parse(JSON.stringify(STATIC_FALLBACK));

function getRandomFallback(level: string): GenerateTextResponse {
  const pool = runtimePool[level] ?? runtimePool['Medium'];
  return pool[Math.floor(Math.random() * pool.length)];
}

const LEVELS = ['Easy', 'Medium', 'Hard'] as const;
type Level = typeof LEVELS[number];

interface AssessmentResult {
  transcript: string;
  reference: string;
  accuracy: number;
  wer: number;
  cer: number;
}

export const PronunciationAssessment = () => {
  const { user } = useAuth();

  const [selectedLevel, setSelectedLevel]         = useState<Level>('Medium');
  const [currentSentenceData, setCurrentSentenceData] = useState<GenerateTextResponse | null>(null);
  const [isGenerating, setIsGenerating]           = useState(false);
  const [assessmentResult, setAssessmentResult]   = useState<AssessmentResult | null>(null);
  const [isAssessing, setIsAssessing]             = useState(false);
  const [verifyResult, setVerifyResult]           = useState<PronunciationAndVerifyResponse | null>(null);
  const [error, setError]                         = useState<string | null>(null);
  const [step, setStep]                           = useState<'select' | 'recording' | 'result'>('select');
  const [useVideo, setUseVideo]                   = useState(true);
  const ttsRef = useRef<HTMLAudioElement | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  // Clear cached Audio element whenever the sentence changes
  useEffect(() => {
    if (ttsRef.current) {
      ttsRef.current.pause();
      ttsRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setTtsPlaying(false);
  }, [currentSentenceData?.audio_url]);

  const audioRecorder = useAudioRecorder();
  const videoRecorder = useVideoRecorder();
  const playForScore = playForAccuracy;

  // On mount — load MongoDB sentence pool to grow the fallback list
  useEffect(() => {
    getSentencePool()
      .then(pool => {
        for (const [level, sentences] of Object.entries(pool)) {
          if (sentences.length > 0) {
            // Merge with static fallback, deduplicate by sentence text
            const existing = new Set((runtimePool[level] ?? []).map(s => s.sentence));
            const newOnes = sentences.filter(s => !existing.has(s.sentence));
            runtimePool[level] = [...(runtimePool[level] ?? []), ...newOnes];
          }
        }
      })
      .catch(() => {/* server offline — use static pool */});
  }, []);

  const fetchSentence = async (level: Level): Promise<GenerateTextResponse> => {
    try {
      const data = await generateText(level);
      // Add to runtime pool if new
      if (data.sentence) {
        const existing = new Set((runtimePool[level] ?? []).map(s => s.sentence));
        if (!existing.has(data.sentence)) {
          runtimePool[level] = [...(runtimePool[level] ?? []), data];
        }
      }
      return data;
    } catch {
      return getRandomFallback(level);
    }
  };

  const handleLevelSelect = async (level: Level) => {
    setSelectedLevel(level);
    setError(null);
    setAssessmentResult(null);
    setIsGenerating(true);
    const data = await fetchSentence(level);
    setCurrentSentenceData(data);
    setIsGenerating(false);
    setStep('recording');
  };

  const handleRegenerateSentence = async () => {
    setIsGenerating(true);
    setError(null);
    const data = await fetchSentence(selectedLevel);
    setCurrentSentenceData(data);
    setIsGenerating(false);
    audioRecorder.resetRecording();
    videoRecorder.resetRecording();
  };

  const playTTS = () => {
    const sentence = currentSentenceData?.sentence ?? '';
    if (!sentence) return;

    if (currentSentenceData?.audio_url) {
      // Kokoro TTS — strip trailing slash to avoid double-slash in URL
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
      const url  = `${base}${currentSentenceData.audio_url}`;

      if (ttsRef.current) {
        ttsRef.current.pause();
        ttsRef.current.src = url;
      } else {
        ttsRef.current = new Audio(url);
        ttsRef.current.onended = () => setTtsPlaying(false);
        ttsRef.current.onerror = () => {
          // Kokoro file missing/broken — fall back to browser TTS
          setTtsPlaying(false);
          speakWithBrowser(sentence);
        };
      }
      setTtsPlaying(true);
      ttsRef.current.play().catch(() => speakWithBrowser(sentence));
    } else {
      // No Kokoro audio — use browser Web Speech API
      speakWithBrowser(sentence);
    }
  };

  const speakWithBrowser = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = 'en-US';
    utt.rate   = 0.9;
    utt.onend  = () => setTtsPlaying(false);
    utt.onerror = () => setTtsPlaying(false);
    setTtsPlaying(true);
    window.speechSynthesis.speak(utt);
  };

  const handleStopRecording = () => {
    useVideo ? videoRecorder.stopRecording() : audioRecorder.stopRecording();
  };

  const handleAssess = async () => {
    const blob = useVideo ? videoRecorder.videoBlob : audioRecorder.audioBlob;
    if (!blob) return;

    setIsAssessing(true);
    setError(null);
    setVerifyResult(null);

    try {
      const age = (user as any)?.age ?? 12;

      // Single request — runs ASR + speaker verification in parallel on the backend
      const result = await analyzePronunciationAndVerify(
        currentSentenceData?.sentence ?? '', age, blob
      );

      const safeNum = (v: unknown, fallback = 0) => {
        const n = Number(v);
        return isFinite(n) ? n : fallback;
      };

      const finalResult = {
        transcript: String(result.transcript ?? ''),
        reference:  String(result.reference  ?? currentSentenceData?.sentence ?? ''),
        accuracy:   safeNum(result.accuracy, 0),
        wer:        safeNum(result.wer,      1),
        cer:        safeNum(result.cer,      1),
      };

      setVerifyResult(result);
      setAssessmentResult(finalResult);
      playForScore(finalResult.accuracy);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assessment failed — is the backend running?');
    } finally {
      setIsAssessing(false);
    }
  };

  const handleReset = () => {
    useVideo ? videoRecorder.resetRecording() : audioRecorder.resetRecording();
    setAssessmentResult(null);
    setError(null);
    setStep('recording');
  };

  const handleStartOver = () => {
    setStep('select');
    setAssessmentResult(null);
    setCurrentSentenceData(null);
    setVerifyResult(null);
    setError(null);
    audioRecorder.resetRecording();
    videoRecorder.resetRecording();
  };

  // ── Result screen ────────────────────────────────────────────────────────────
  // If assessmentResult exists but step is 'result' and we somehow get here
  // without a valid result, fall back to the recording screen
  if (step === 'result' && !assessmentResult) {
    setStep('recording');
    return null;
  }

  if (step === 'result' && assessmentResult) {
    // Guard against NaN/undefined from a failed API response
    const acc = isFinite(assessmentResult.accuracy) ? assessmentResult.accuracy : 0;
    const tier = acc >= 90 ? 'excellent' : acc >= 75 ? 'good' : acc >= 50 ? 'poor' : 'try_again';
    const tierConfig = {
      excellent: { emoji: '🏆', label: 'Outstanding!',    sub: 'Perfect pronunciation — you nailed it!',          bg: 'from-yellow-50 to-amber-50', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-800' },
      good:      { emoji: '⭐', label: 'Great Job!',       sub: 'Excellent work — keep it up!',                    bg: 'from-green-50 to-emerald-50', border: 'border-green-300',  badge: 'bg-green-100 text-green-800' },
      poor:      { emoji: '💪', label: 'Good Effort!',     sub: "You're improving — listen and try again!",        bg: 'from-blue-50 to-cyan-50',    border: 'border-blue-300',   badge: 'bg-blue-100 text-blue-800' },
      try_again: { emoji: '🎯', label: 'Keep Practicing!', sub: 'Every attempt makes you better — try once more!', bg: 'from-orange-50 to-red-50',   border: 'border-orange-300', badge: 'bg-orange-100 text-orange-800' },
    }[tier];

    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Animated result banner */}
          <div className={`mb-6 p-5 rounded-2xl border-2 bg-gradient-to-r ${tierConfig.bg} ${tierConfig.border} text-center`}
            style={{ animation: 'resultPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div className="text-5xl mb-2" style={{ animation: tier === 'excellent' ? 'spin 0.6s ease' : 'none' }}>
              {tierConfig.emoji}
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">{tierConfig.label}</h2>
            <p className="text-gray-600 text-sm">{tierConfig.sub}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${tierConfig.badge}`}>
              {acc.toFixed(1)}% accuracy
            </span>
          </div>
          <p className="text-center text-gray-500 text-sm mb-6">Level: <strong>{selectedLevel}</strong>{user && <> · <strong>{user.full_name}</strong></>}</p>
          <style>{`
            @keyframes resultPop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes spin { from { transform: rotate(-20deg) scale(0.5); } to { transform: rotate(0deg) scale(1); } }
          `}</style>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <ScoreCard label="Accuracy" value={`${assessmentResult.accuracy.toFixed(1)}%`} color="blue" />
            <ScoreCard label="Word Error" value={`${(assessmentResult.wer * 100).toFixed(1)}%`} color="purple" />
            <ScoreCard label="Char Error" value={`${(assessmentResult.cer * 100).toFixed(1)}%`} color="pink" />
          </div>

          {/* ── Identity verification badge ─────────────────────────────────── */}
          {verifyResult && (
            <div className={`mb-5 p-4 rounded-xl border-2 flex items-center gap-3 ${
              verifyResult.verification_status === 'not_enrolled'
                ? 'bg-gray-50 border-gray-200'
                : verifyResult.verified
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
            }`}>
              <span className="text-2xl">
                {verifyResult.verification_status === 'not_enrolled' ? '⚠️'
                  : verifyResult.verified ? '🔒' : '🚨'}
              </span>
              <div className="flex-1">
                <p className={`font-bold text-sm ${
                  verifyResult.verification_status === 'not_enrolled'
                    ? 'text-gray-600'
                    : verifyResult.verified ? 'text-green-800' : 'text-red-800'
                }`}>
                  {verifyResult.verification_status === 'not_enrolled'
                    ? 'Identity: Not enrolled — complete enrollment first'
                    : verifyResult.verified
                      ? `✅ Identity Verified — voice matched (${(verifyResult.similarity * 100).toFixed(1)}% confidence)`
                      : `❌ Voice Mismatch — does not match enrolled profile (${(verifyResult.similarity * 100).toFixed(1)}% similarity)`}
                </p>
                {verifyResult.verification_status !== 'not_enrolled' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Threshold: {(user as any)?.age < 12 ? '65%' : '75%'} · EER: {(verifyResult.eer * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              {verifyResult.verification_status !== 'not_enrolled' && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  verifyResult.verified
                    ? 'bg-green-200 text-green-800'
                    : 'bg-red-200 text-red-800'
                }`}>
                  {verifyResult.verification_status}
                </span>
              )}
            </div>
          )}

          <div className="space-y-3 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Reference Text</p>
              <p className="text-gray-800">{assessmentResult.reference}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Your Transcript (ASR output)</p>
              <p className="text-gray-800">{assessmentResult.transcript || <em className="text-gray-400">No speech detected</em>}</p>
            </div>
          </div>

          <GuideBox type={tier === 'excellent' || tier === 'good' ? 'success' : 'info'} title={tier === 'excellent' || tier === 'good' ? 'Excellent Pronunciation!' : 'Room for Improvement'}>
            {tier === 'excellent' || tier === 'good' ? 'Your pronunciation is clear and accurate. Try a harder level!' : 'Focus on clear enunciation. Listen to the TTS example and try again!'}
          </GuideBox>

          <div className="flex gap-4 justify-center mt-6">
            <button onClick={handleReset} className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all shadow-md">Try Again</button>
            <button onClick={handleStartOver} className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all">Change Level</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Recording screen ─────────────────────────────────────────────────────────
  if (step === 'recording') {
    const sentence = currentSentenceData?.sentence ?? '';
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Assessment — <span className="text-blue-600">{selectedLevel}</span></h2>
            <button onClick={handleRegenerateSentence} disabled={isGenerating || audioRecorder.isRecording || videoRecorder.isRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition disabled:opacity-50">
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'New sentence'}
            </button>
          </div>

          {/* Sentence card */}
          <div className="mb-5 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-5 relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            )}
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-xl font-medium text-gray-800 leading-relaxed flex-1">"{sentence}"</p>
              <button onClick={playTTS} title="Listen to pronunciation"
                className={`shrink-0 w-10 h-10 flex items-center justify-center text-white rounded-full transition shadow-md ${
                  ttsPlaying ? 'bg-blue-400 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
                }`}>
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Fact */}
            {currentSentenceData?.fact && (
              <div className="flex items-start gap-2 mb-2 text-sm text-blue-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>Fact:</strong> {currentSentenceData.fact}</span>
              </div>
            )}

            {/* Pronunciation tip */}
            {currentSentenceData?.tip && (
              <div className="flex items-start gap-2 text-sm text-emerald-700">
                <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>Tip:</strong> {currentSentenceData.tip}</span>
              </div>
            )}
          </div>

          <GuideBox type="info" title="What to Do">
            Read the sentence above clearly. Click the 🔊 button to hear a TTS example first. Your recording is analyzed by Wav2Vec2 ASR.
          </GuideBox>

          <div className="mb-6 mt-5 flex items-center gap-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <button onClick={() => setUseVideo(!useVideo)}
              disabled={audioRecorder.isRecording || videoRecorder.isRecording}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                useVideo ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>
              {useVideo ? <Video className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {useVideo ? 'Video' : 'Audio Only'}
            </button>
            <Tooltip content={useVideo ? 'Recording with camera' : 'Recording audio only'} position="right" />
          </div>

          {useVideo ? (
            <div className="mb-8">
              <VideoPreview videoRef={videoRecorder.setVideoRef} isRecording={videoRecorder.isRecording} />
            </div>
          ) : (
            <div className="mb-8 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Audio Waveform</p>
              <AudioVisualizer analyser={audioRecorder.getAnalyser()} isActive={audioRecorder.isRecording && !audioRecorder.isPaused} />
            </div>
          )}

          <RecordingControls
            isRecording={useVideo ? videoRecorder.isRecording : audioRecorder.isRecording}
            isPaused={useVideo ? videoRecorder.isPaused : audioRecorder.isPaused}
            recordingTime={useVideo ? videoRecorder.recordingTime : audioRecorder.recordingTime}
            onStart={useVideo ? videoRecorder.startRecording : audioRecorder.startRecording}
            onStop={handleStopRecording}
            onPause={useVideo ? videoRecorder.pauseRecording : audioRecorder.pauseRecording}
            onResume={useVideo ? videoRecorder.resumeRecording : audioRecorder.resumeRecording}
            onReset={useVideo ? videoRecorder.resetRecording : audioRecorder.resetRecording}
          />

          {((useVideo ? videoRecorder.videoBlob : audioRecorder.audioBlob) &&
            !(useVideo ? videoRecorder.isRecording : audioRecorder.isRecording)) && (
            <div className="mt-8 space-y-6">
              <GuideBox type="success" title="Recording Complete">
                Click "Assess Pronunciation" to send your audio to the FastAPI backend.
              </GuideBox>
              <div className="space-y-3">
                {useVideo && videoRecorder.videoUrl
                  ? <video src={videoRecorder.videoUrl} controls className="w-full max-w-md mx-auto rounded-lg bg-black aspect-video" />
                  : <audio src={audioRecorder.audioUrl || ''} controls className="w-full max-w-md mx-auto" />}
              </div>
              <div className="flex gap-3 justify-center">
                <button onClick={handleAssess} disabled={isAssessing}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg font-semibold transition-all shadow-md">
                  {isAssessing ? 'Analyzing...' : 'Assess Pronunciation'}
                </button>
                <button onClick={useVideo ? videoRecorder.resetRecording : audioRecorder.resetRecording}
                  disabled={isAssessing}
                  className="px-8 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded-lg font-semibold transition-all">
                  Re-record
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Level select screen ──────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gradient-to-br from-orange-500 to-red-500 p-4 rounded-full">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Pronunciation Assessment</h1>
        <p className="text-center text-gray-600 mb-8">
          Choose a difficulty. A sentence is generated by <strong>Groq (Llama 3.1)</strong>, read aloud with <strong>Kokoro TTS</strong>, then your voice is scored by <strong>Wav2Vec2 ASR</strong>.
        </p>

        <GuideBox type="info" title="How It Works">
          1. Pick a level → AI generates a sentence with a fact and pronunciation tip.<br />
          2. Click 🔊 to hear the correct pronunciation (Kokoro TTS).<br />
          3. Record yourself reading it → get accuracy, WER, and CER scores.
        </GuideBox>

        <div className="mt-8 space-y-4">
          {LEVELS.map(level => {
            const sample = getRandomFallback(level);
            return (
              <button key={level} onClick={() => handleLevelSelect(level)} disabled={isGenerating}
                className="w-full p-6 text-left border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-lg font-semibold text-gray-800 group-hover:text-blue-600">{level}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {level === 'Easy' ? '6-10 words' : level === 'Medium' ? '10-15 words' : '15-25 words'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm italic">e.g. "{sample.sentence}"</p>
                    {sample.fact && <p className="text-xs text-blue-500 mt-1">💡 {sample.fact}</p>}
                  </div>
                  <Sparkles className="w-5 h-5 text-gray-300 group-hover:text-blue-400 shrink-0 ml-4" />
                </div>
              </button>
            );
          })}
        </div>

        {isGenerating && (
          <div className="mt-6 flex items-center gap-3 text-sm text-purple-600 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Generating sentence with Groq + Llama 3.1...
          </div>
        )}
      </div>
    </div>
  );
};

function ScoreCard({ label, value, color }: { label: string; value: string; color: 'blue' | 'purple' | 'pink' }) {
  const cls = { blue: 'bg-blue-50 border-blue-200 text-blue-600', purple: 'bg-purple-50 border-purple-200 text-purple-600', pink: 'bg-pink-50 border-pink-200 text-pink-600' }[color];
  return (
    <div className={`p-4 rounded-lg border-2 text-center ${cls}`}>
      <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}