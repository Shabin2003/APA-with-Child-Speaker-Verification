/**
 * useSmartSpeech
 *
 * Automatically picks the best speech recognition method:
 *   - Chrome or Edge  → browser Web Speech API (instant, no server needed)
 *   - Any other browser → FastAPI Wav2Vec2 ASR (accurate, works everywhere)
 *
 * Returns a unified interface so components don't need to care which is used.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio } from '../lib/api';

interface UseSmartSpeechResult {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  error: string | null;
  engine: 'browser' | 'asr' | null;  // which engine is active
  start: () => void | Promise<void>;
  stop: () => void;
  reset: () => void;
}

/** Returns true when the browser natively supports Web Speech API well (Chrome/Edge) */
function isBrowserSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const hasApi = !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
  if (!hasApi) return false;

  const ua = navigator.userAgent.toLowerCase();
  // Only use browser speech on Chrome or Edge — Firefox/Safari implementations are unreliable
  return ua.includes('chrome') || ua.includes('edg');
}

export function useSmartSpeech(autoStopMs = 4000): UseSmartSpeechResult {
  const [isRecording, setIsRecording]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript]         = useState('');
  const [error, setError]                   = useState<string | null>(null);

  const useBrowser = isBrowserSpeechSupported();
  const engine: 'browser' | 'asr' | null = isRecording || isTranscribing || transcript ? (useBrowser ? 'browser' : 'asr') : null;

  // ── Browser Speech Recognition path ────────────────────────────────────────
  const recognitionRef  = useRef<any>(null);
  const transcriptRef   = useRef('');
  const autoStopBrowser = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopBrowser = useCallback(() => {
    if (autoStopBrowser.current) { clearTimeout(autoStopBrowser.current); autoStopBrowser.current = null; }
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const startBrowser = useCallback(() => {
    const SpeechApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechApi();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      // Build transcript from all results, only using finalized or latest interim
      let finalTranscript = '';
      let lastInterim = '';
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += result + ' ';
        } else {
          lastInterim = result;
        }
      }
      // Combine finalized and latest interim, trim, and deduplicate repeated words
      let combined = (finalTranscript + lastInterim).trim();
      // Remove repeated consecutive words (simple approach)
      combined = combined.replace(/(\b\w+\b)(?:\s+\1\b)+/gi, '$1');
      transcriptRef.current = combined;
      setTranscript(combined);
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') setError(`Speech error: ${e.error}`);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);

    if (autoStopMs > 0) {
      autoStopBrowser.current = setTimeout(() => stopBrowser(), autoStopMs);
    }
  }, [autoStopMs, stopBrowser]);

  // ── FastAPI ASR path ────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const autoStopAsr      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);

  const stopAsr = useCallback(() => {
    if (autoStopAsr.current) { clearTimeout(autoStopAsr.current); autoStopAsr.current = null; }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    setIsRecording(false);
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(blob);
      setTranscript(result.transcript ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startAsr = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ['audio/webm', 'audio/ogg', ''].find(m => m === '' || MediaRecorder.isTypeSupported(m)) ?? '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        await transcribeBlob(blob);
      };

      mr.start(100);
      setIsRecording(true);

      if (autoStopMs > 0) {
        autoStopAsr.current = setTimeout(() => stopAsr(), autoStopMs);
      }
    } catch {
      setError('Microphone access denied.');
    }
  }, [autoStopMs, stopAsr, transcribeBlob]);

  // ── Unified API ─────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    setError(null);
    setTranscript('');
    transcriptRef.current = '';
    chunksRef.current = [];
    return useBrowser ? startBrowser() : startAsr();
  }, [useBrowser, startBrowser, startAsr]);

  const stop = useCallback(() => {
    return useBrowser ? stopBrowser() : stopAsr();
  }, [useBrowser, stopBrowser, stopAsr]);

  const reset = useCallback(() => {
    stopBrowser();
    stopAsr();
    streamRef.current?.getTracks().forEach(t => t.stop());
    transcriptRef.current = '';
    chunksRef.current = [];
    setIsRecording(false);
    setIsTranscribing(false);
    setTranscript('');
    setError(null);
  }, [stopBrowser, stopAsr]);

  // Cleanup on unmount
  useEffect(() => () => { reset(); }, []);  // eslint-disable-line

  return {
    isRecording,
    isTranscribing,
    transcript,
    error,
    engine: isRecording ? (useBrowser ? 'browser' : 'asr') : (transcript ? (useBrowser ? 'browser' : 'asr') : null),
    start,
    stop,
    reset,
  };
}
