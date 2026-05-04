import { useState, useEffect } from 'react';
import { UserPlus, CheckCircle, AlertCircle, Volume2, Video, Wifi, WifiOff, ShieldCheck } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useVideoRecorder } from '../hooks/useVideoRecorder';
import { enrollSpeaker, checkHealth, getUserProfile } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AudioVisualizer } from './AudioVisualizer';
import { RecordingControls } from './RecordingControls';
import { VideoPreview } from './VideoPreview';
import { Tooltip } from './Tooltip';
import { GuideBox } from './GuideBox';

const ENROLLMENT_PROMPTS = [
  'Hello, my name is and I am a student here',
  'I like to play with my friends after school',
  'The quick brown fox jumps over the lazy dog',
];

export const SpeakerEnrollment = () => {
  const { user } = useAuth();

  const [age, setAge]                         = useState('');
  const [step, setStep]                       = useState<'form' | 'recording' | 'complete'>('form');
  const [currentPrompt, setCurrentPrompt]     = useState(0);
  const [enrolledSamples, setEnrolledSamples] = useState(0);
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [useVideo, setUseVideo]               = useState(true);
  const [backendStatus, setBackendStatus]     = useState<'checking' | 'online' | 'offline'>('checking');
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);

  const audioRecorder = useAudioRecorder();
  const videoRecorder = useVideoRecorder();
  const speakerId = user?.id ?? null;

  useEffect(() => {
    checkHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));

    // Load age + enrollment status from MongoDB via FastAPI
    if (user?.id) {
      getUserProfile()
        .then(profile => {
          if (profile.age)      setAge(String(profile.age));
          if (profile.enrolled) setAlreadyEnrolled(true);
        })
        .catch(() => {/* non-fatal */});
    }
  }, [user?.id]);

  // Listen for camera/mic permission dismissal fired by the recorder hooks
  useEffect(() => {
    const handler = (e: Event) => {
      const reason = (e as CustomEvent).detail?.reason ?? 'unknown';
      const msg = reason === 'dismissed'
        ? 'Camera/microphone permission was dismissed. Click Allow when the browser asks for permission.'
        : reason === 'no-device'
        ? 'No camera or microphone found. Switch to Audio Only mode or connect a device.'
        : `Could not access media device: ${reason}`;
      setError(msg);
    };
    window.addEventListener('recording-permission-denied', handler);
    return () => window.removeEventListener('recording-permission-denied', handler);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!age)       { setError('Please enter your age'); return; }
    if (!speakerId) { setError('You must be logged in to enroll'); return; }
    setStep('recording');
  };

  const handleStopRecording = () => {
    useVideo ? videoRecorder.stopRecording() : audioRecorder.stopRecording();
  };

  const handleSaveSample = async () => {
    const blob = useVideo ? videoRecorder.videoBlob : audioRecorder.audioBlob;
    if (!blob || !speakerId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      // POST /speaker/enroll — saves embedding to MongoDB
      await enrollSpeaker(speakerId, parseInt(age), blob);

      const newCount = enrolledSamples + 1;
      setEnrolledSamples(newCount);
      useVideo ? videoRecorder.resetRecording() : audioRecorder.resetRecording();

      if (newCount >= 3) {
        setAlreadyEnrolled(true);
        setStep('complete');
      } else {
        setCurrentPrompt(currentPrompt + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed — is the backend running?');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartOver = () => {
    setStep('form');
    setCurrentPrompt(0);
    setEnrolledSamples(0);
    setError(null);
    audioRecorder.resetRecording();
    videoRecorder.resetRecording();
  };

  if (step === 'complete') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">Enrollment Complete!</h2>
          <p className="text-center text-gray-600 mb-2">
            <strong>{user?.full_name}</strong>, your voice embeddings are saved in MongoDB.
          </p>
          <p className="text-center text-xs text-gray-400 font-mono mb-2">Speaker ID: {speakerId}</p>
          <p className="text-center text-xs text-green-600 font-semibold mb-8 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> 3 voice samples stored in MongoDB
          </p>
          <GuideBox type="success" title="What's Next">
            Head to the Speaker Verification tab — your UID is pre-filled automatically.
          </GuideBox>
          <div className="mt-8 flex gap-4 justify-center">
            <button onClick={handleStartOver}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold transition-all shadow-md">
              Re-enroll Voice
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'recording') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Voice Sample {enrolledSamples + 1} of 3</h2>
              <Tooltip content="Clear, natural speech helps improve accuracy" />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                  {i < enrolledSamples  && <div className="h-full bg-gradient-to-r from-green-400 to-green-500" />}
                  {i === enrolledSamples && <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500" />}
                </div>
              ))}
            </div>
          </div>

          <GuideBox type="info" title="What to Do">
            Read the sentence below clearly. Sent to <code className="text-xs font-mono bg-gray-100 px-1 rounded">POST /speaker/enroll</code> on FastAPI using your Firebase UID.
          </GuideBox>

          <div className="mb-6 mt-6 flex items-center gap-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <button onClick={() => setUseVideo(!useVideo)}
              disabled={audioRecorder.isRecording || videoRecorder.isRecording}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                useVideo ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>
              {useVideo ? <Video className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {useVideo ? 'Video' : 'Audio Only'}
            </button>
          </div>

          <div className="mt-2 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-5 h-5 text-blue-500" />
              <p className="text-sm font-semibold text-gray-700">Read this sentence:</p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-6">
              <p className="text-2xl text-center font-medium text-gray-800 leading-relaxed">
                "{ENROLLMENT_PROMPTS[Math.min(currentPrompt, ENROLLMENT_PROMPTS.length - 1)]}"
              </p>
            </div>
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
                Click Save & Continue to send this sample to the FastAPI backend.
              </GuideBox>
              <div className="space-y-3">
                {useVideo && videoRecorder.videoUrl
                  ? <video src={videoRecorder.videoUrl} controls className="w-full max-w-md mx-auto rounded-lg bg-black aspect-video" />
                  : <audio src={audioRecorder.audioUrl || ''} controls className="w-full max-w-md mx-auto" />}
              </div>
              <div className="flex gap-3 justify-center">
                <button onClick={handleSaveSample} disabled={isSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg font-semibold transition-all shadow-md">
                  {isSubmitting ? 'Sending to backend...' : 'Save & Continue'}
                </button>
                <button onClick={useVideo ? videoRecorder.resetRecording : audioRecorder.resetRecording}
                  disabled={isSubmitting}
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

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
            backendStatus === 'online'  ? 'bg-green-50 text-green-700' :
            backendStatus === 'offline' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
          }`}>
            {backendStatus === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            FastAPI: {backendStatus}
          </span>
          {alreadyEnrolled && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-3 h-3" /> Voice already enrolled
            </span>
          )}
        </div>

        <div className="flex items-center justify-center mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-full">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Speaker Enrollment</h1>
        <p className="text-center text-gray-600 mb-8">
          {alreadyEnrolled ? 'Already enrolled. Re-enroll below to update your voice profile.' : 'Record 3 voice samples to create your voice profile.'}
        </p>

        <GuideBox type="info" title="How It Works">
          Your Firebase UID is used as the speaker ID. Voice embeddings are stored in <strong>MongoDB</strong> via FastAPI — no Firestore involved.
        </GuideBox>

        {user && (
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
            <p className="text-sm font-semibold text-blue-900">{user.full_name}</p>
            <p className="text-xs text-blue-700">{user.email}</p>
            <p className="text-xs text-blue-400 font-mono">UID / Speaker ID: {user.id}</p>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter your age" min="1" max="120" required />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {backendStatus === 'offline' && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <WifiOff className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-amber-800 text-sm">
                Backend not reachable at <code className="font-mono">{import.meta.env.VITE_API_URL || 'http://localhost:8000'}</code>.
                Run <code className="font-mono">uvicorn main:app --reload</code>.
              </p>
            </div>
          )}

          <button type="submit" disabled={backendStatus === 'offline'}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-all shadow-md">
            {alreadyEnrolled ? 'Re-enroll Voice' : 'Continue to Recording'}
          </button>
        </form>
      </div>
    </div>
  );
};