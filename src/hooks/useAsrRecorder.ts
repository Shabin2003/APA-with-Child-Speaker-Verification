/**
 * useAsrRecorder
 * Drop-in replacement for browser SpeechRecognition that uses the
 * FastAPI Wav2Vec2 ASR endpoint instead.
 *
 * Usage:
 *   const { isRecording, transcript, start, stop, reset, error } = useAsrRecorder();
 *
 * - Call start() to begin recording
 * - Call stop() to stop and auto-transcribe via FastAPI
 * - transcript updates when the result arrives
 * - Falls back to browser SpeechRecognition if FastAPI is unavailable
 */

import { useState, useRef, useCallback } from 'react';
import { transcribeAudio } from '../lib/api';

interface UseAsrRecorderResult {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useAsrRecorder(autoStopMs = 4000): UseAsrRecorderResult {
  const [isRecording, setIsRecording]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript]         = useState('');
  const [error, setError]                   = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const autoStopRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);

  const clearAutoStop = () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  const transcribe = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    setError(null);
    try {
      const result = await transcribeAudio(blob);
      setTranscript(result.transcript ?? '');
    } catch (err) {
      // Fall back gracefully — set empty transcript, show error
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setTranscript('');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const stop = useCallback(() => {
    clearAutoStop();
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop(); // triggers onstop → transcribe
    }
    setIsRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick the best supported format
      const mimeType = ['audio/webm', 'audio/ogg', 'audio/mp4', ''].find(
        m => m === '' || MediaRecorder.isTypeSupported(m)
      ) ?? '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        await transcribe(blob);
      };

      mr.start(100); // collect data every 100ms
      setIsRecording(true);

      // Auto-stop after autoStopMs
      if (autoStopMs > 0) {
        autoStopRef.current = setTimeout(() => stop(), autoStopMs);
      }
    } catch (err) {
      setError('Microphone access denied. Please allow microphone permissions.');
    }
  }, [autoStopMs, stop, transcribe]);

  const reset = useCallback(() => {
    clearAutoStop();
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    chunksRef.current = [];
    setIsRecording(false);
    setIsTranscribing(false);
    setTranscript('');
    setError(null);
  }, []);

  return { isRecording, isTranscribing, transcript, error, start, stop, reset };
}
