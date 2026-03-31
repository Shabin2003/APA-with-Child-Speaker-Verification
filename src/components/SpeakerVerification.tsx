import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertCircle, Volume2, Video, ShieldCheck, ShieldX, User } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useVideoRecorder } from '../hooks/useVideoRecorder';
import { verifySpeaker, getUserProfile } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AudioVisualizer } from './AudioVisualizer';
import { RecordingControls } from './RecordingControls';
import { VideoPreview } from './VideoPreview';
import { Tooltip } from './Tooltip';
import { GuideBox } from './GuideBox';

const VERIFICATION_PROMPT = 'Hello, this is me speaking for verification';

export const SpeakerVerification = () => {
  const { user } = useAuth();

  const [age, setAge]               = useState('');
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
  const [step, setStep]             = useState<'input' | 'recording' | 'result'>('input');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [useVideo, setUseVideo]     = useState(true);
  const [result, setResult]         = useState<{ similarity: number; eer: number; decision: string } | null>(null);

  const audioRecorder = useAudioRecorder();
  const videoRecorder = useVideoRecorder();
  const speakerId = user?.id ?? '';

  // Load age + enrollment status from MongoDB via FastAPI
  useEffect(() => {
    if (!user?.id) return;
    getUserProfile()
      .then(profile => {
        if (profile.age)      setAge(String(profile.age));
        setIsEnrolled(!!profile.enrolled);
      })
      .catch(() => setIsEnrolled(false));
  }, [user?.id]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!age) { setError('Please enter your age'); return; }
    setStep('recording');
    setVerificationStatus('idle');
    setResult(null);
  };

  const handleStopRecording = () => {
    useVideo ? videoRecorder.stopRecording() : audioRecorder.stopRecording();
  };

  const handleVerify = async () => {
    const blob = useVideo ? videoRecorder.videoBlob : audioRecorder.audioBlob;
    if (!blob || !speakerId) return;

    setIsSubmitting(true);
    setVerificationStatus('verifying');
    setError(null);

    try {
      // POST /speaker/verify — compares against MongoDB-stored embeddings
      const res = await verifySpeaker(speakerId, parseInt(age), blob);
      setResult(res);
      setVerificationStatus(res.decision === 'ACCEPT' ? 'success' : 'failed');
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed — is the backend running?');
      setVerificationStatus('failed');
      setStep('result');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    useVideo ? videoRecorder.resetRecording() : audioRecorder.resetRecording();
    setVerificationStatus('idle');
    setResult(null);
    setError(null);
    setStep('recording');
  };

  const handleStartOver = () => {
    setStep('input');
    setVerificationStatus('idle');
    setResult(null);
    setError(null);
    audioRecorder.resetRecording();
    videoRecorder.resetRecording();
  };

  // ── Result ──────────────────────────────────────────────────────────────────
  if (step === 'result') {
    const accepted = verificationStatus === 'success';
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            {accepted ? <CheckCircle className="w-16 h-16 text-green-500" /> : <XCircle className="w-16 h-16 text-red-500" />}
          </div>
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
            {accepted ? 'Identity Verified!' : 'Verification Failed'}
          </h2>
          <p className="text-center text-gray-500 text-sm mb-6">
            {user?.full_name} · <span className="font-mono text-xs">{speakerId.slice(0, 16)}…</span>
          </p>

          {result && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 text-center">
                <p className="text-xs font-semibold text-gray-600 mb-1">Confidence</p>
                <p className="text-2xl font-bold text-blue-600">{(result.similarity * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 text-center">
                <p className="text-xs font-semibold text-gray-600 mb-1">EER</p>
                <p className="text-2xl font-bold text-purple-600">{(result.eer * 100).toFixed(1)}%</p>
              </div>
              <div className={`p-4 rounded-lg border-2 text-center ${accepted ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-xs font-semibold text-gray-600 mb-1">Decision</p>
                <p className={`text-lg font-bold ${accepted ? 'text-green-600' : 'text-red-600'}`}>{result.decision}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <GuideBox type={accepted ? 'success' : 'error'}
            title={accepted ? 'Verification Successful' : 'Verification Unsuccessful'}>
            {accepted
              ? 'Your voice matched the enrolled profile stored in MongoDB.'
              : 'Voice did not match. Make sure you enrolled first and speak clearly.'}
          </GuideBox>

          <div className="mt-8 flex gap-4 justify-center">
            <button onClick={handleReset} className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all shadow-md">
              Try Again
            </button>
            <button onClick={handleStartOver} className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Recording ───────────────────────────────────────────────────────────────
  if (step === 'recording') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Voice Verification</h2>
            <p className="text-sm text-gray-500">
              {user?.full_name} · <span className="font-mono text-xs">{speakerId.slice(0, 16)}…</span>
            </p>
          </div>

          <GuideBox type="info" title="What to Do">
            Read the sentence below clearly. Sent to <code className="text-xs font-mono bg-gray-100 px-1 rounded">POST /speaker/verify</code> — compared against your MongoDB voice embeddings.
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
            <Tooltip content={useVideo ? 'Recording with camera' : 'Recording audio only'} position="right" />
          </div>

          <div className="mt-2 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-5 h-5 text-blue-500" />
              <p className="text-sm font-semibold text-gray-700">Read this sentence:</p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-6">
              <p className="text-2xl text-center font-medium text-gray-800 leading-relaxed">"{VERIFICATION_PROMPT}"</p>
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
                Click Verify Identity to send to FastAPI for matching against MongoDB embeddings.
              </GuideBox>
              <div className="space-y-3">
                {useVideo && videoRecorder.videoUrl
                  ? <video src={videoRecorder.videoUrl} controls className="w-full max-w-md mx-auto rounded-lg bg-black aspect-video" />
                  : <audio src={audioRecorder.audioUrl || ''} controls className="w-full max-w-md mx-auto" />}
              </div>
              <div className="flex gap-3 justify-center">
                <button onClick={handleVerify} disabled={isSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg font-semibold transition-all shadow-md">
                  {isSubmitting ? 'Verifying...' : 'Verify Identity'}
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

  // ── Input ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-4 rounded-full">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Speaker Verification</h1>
        <p className="text-center text-gray-600 mb-8">Verify your voice identity against your MongoDB voice profile.</p>

        {isEnrolled === null ? (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Checking enrollment status from MongoDB...
          </div>
        ) : isEnrolled ? (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Voice profile enrolled in MongoDB</p>
              <p className="text-xs text-green-600">Ready to verify. Firebase UID is pre-filled as the speaker ID.</p>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <ShieldX className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Not enrolled yet</p>
              <p className="text-xs text-amber-600">Go to the Enrollment tab first to create your voice profile.</p>
            </div>
          </div>
        )}

        <GuideBox type="info" title="How It Works">
          Your Firebase UID is automatically used as the speaker ID. FastAPI matches your recording against embeddings stored in <strong>MongoDB</strong>.
        </GuideBox>

        {user && (
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-semibold text-blue-900">{user.full_name}</p>
            </div>
            <p className="text-xs text-blue-700 pl-6">{user.email}</p>
            <p className="text-xs text-blue-400 font-mono pl-6">Speaker ID (UID): {speakerId}</p>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Age <span className="text-gray-400 font-normal">(sets matching threshold)</span>
            </label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
              placeholder="Enter your age" min="1" max="120" required />
            <p className="text-xs text-gray-400 mt-1">Under 12: threshold 0.65 · 12 and above: threshold 0.75</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={isEnrolled === false}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-40 text-white rounded-lg font-semibold transition-all shadow-md">
            {isEnrolled === false ? 'Enroll First to Verify' : 'Continue to Verification'}
          </button>
        </form>
      </div>
    </div>
  );
};
